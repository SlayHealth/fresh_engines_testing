const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');
const reportGenerationService = require('../services/compatibility/reportGeneration.service');

// UX8-05: the invite link previously always used a static APP_URL env value with
// no validation — when it drifted from the frontend's real serving origin (a
// stale LAN IP in this exact repro), every invite link handed to an account
// holder was dead on arrival, with no error surfaced anywhere. The frontend
// browser making this request knows its own real origin reliably
// (window.location.origin) — trusted here since it only affects a link shown
// back to the same authenticated caller, not an authorization decision.
// APP_URL remains the fallback for non-browser callers.
function resolveAppOrigin(candidateOrigin) {
  const isValidHttpOrigin = (value) => {
    if (typeof value !== 'string' || !value) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  if (isValidHttpOrigin(candidateOrigin)) return candidateOrigin;
  if (isValidHttpOrigin(process.env.APP_URL)) return process.env.APP_URL;

  logger.warn('[InviteController] Neither the request-supplied appOrigin nor APP_URL is a valid http(s) URL — falling back to http://localhost:3000. Invite links will likely be unreachable.');
  return 'http://localhost:3000';
}

// Import parsing services for background processing
const ocrProvider = require('../services/ocr/ocrProvider');
const parameterExtractor = require('../services/parser/parameterExtractor.service');
const ocrSpaceService = require('../services/ocr/ocrSpace.service');
const radiologyController = require('./radiology.controller');

// Import scoring & matching logic
const chronicController = require('./chronic.controller');
const mfrController = require('./mfr.controller');
const { computeMentalResult, isMentalQuestionnaireComplete } = require('./mental.controller');
const ontologyMapper = require('../services/parser/ontologyMapper.service');
const whatsappMessageLog = require('../services/notification/whatsappMessageLog.service');

function calculateAge(dobString) {
  if (!dobString) return 30;
  const birthDate = new Date(dobString);
  const difference = Date.now() - birthDate.getTime();
  const ageDate = new Date(difference);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 30;
}

function classifyWaist(waistVal, gender) {
  const val = parseFloat(waistVal);
  if (isNaN(val)) return 'Normal';
  if (gender === 'male') {
    if (val >= 90) return 'High';
    if (val >= 85) return 'Borderline';
    return 'Normal';
  } else {
    if (val >= 80) return 'High';
    if (val >= 75) return 'Borderline';
    return 'Normal';
  }
}

/**
 * Content-driven gender resolver.
 */
function resolveGenderRoleFromReport(extractedJson, rawText = '') {
  const resolved = ontologyMapper.resolveGenderRole(extractedJson, rawText);
  if (resolved) {
    logger.info(`[resolveGenderRoleFromReport] Resolved ${resolved.toUpperCase()} from report content`);
  } else {
    logger.warn('[resolveGenderRoleFromReport] Could not determine gender from report contents');
  }
  return resolved;
}



// Map for active SSE connections: userId -> Array of response objects
const activeConnections = new Map();

/**
 * Broadcast status update to all connected clients for a user
 */
function broadcastInviteUpdate(userId, inviteId, status, details = {}) {
  const clients = activeConnections.get(userId);
  if (clients && clients.length > 0) {
    logger.info(`Broadcasting status update: inviteId=${inviteId}, status=${status} to user=${userId}`);
    clients.forEach(res => {
      res.write(`data: ${JSON.stringify({ type: 'invite_update', inviteId, status, ...details })}\n\n`);
    });
  }
}

/**
 * Create a new prospect invite
 */
async function createInvite(req, res, next) {
  const inviterId = req.user?.id; // Set by authenticateToken middleware
  if (!inviterId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User ID not found' });
  }

  try {
    const { prospectName, mentalAnswers, appOrigin } = req.body;
    if (!prospectName) {
      return res.status(400).json({ success: false, error: 'Prospect Name is required' });
    }

    // Generate secure random token (32 bytes)
    const token = crypto.randomBytes(32).toString('hex');
    const inviteId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create a placeholder prospect user row, keyed by a synthetic identifier
    // (no phone number is collected anymore — the inviter shares the link manually).
    const prospectUserId = uuidv4();
    const placeholderPhone = `invite-${inviteId}`;
    const userRes = await db.query(
      `INSERT INTO users (id, phone_number, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [prospectUserId, placeholderPhone, prospectName]
    );
    const finalProspectUserId = userRes.rows[0].id;

    const mentalAnswersJson = mentalAnswers && Object.keys(mentalAnswers).length > 0
      ? JSON.stringify({ inviter: mentalAnswers })
      : null;

    // Save invite record — status starts at 'sent' since the link is ready to share immediately
    await db.query(
      `INSERT INTO prospect_invites (id, user_id, prospect_user_id, prospect_name, prospect_phone, token, status, expires_at, mental_answers_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [inviteId, inviterId, finalProspectUserId, prospectName, null, token, 'sent', expiresAt, mentalAnswersJson]
    );

    const link = `${resolveAppOrigin(appOrigin)}/invite/${token}`;

    return res.status(201).json({
      success: true,
      message: 'Invite link generated',
      invite: {
        id: inviteId,
        prospectName,
        token,
        link,
        status: 'sent',
        expiresAt
      }
    });
  } catch (error) {
    logger.error(`Failed to create invite: ${error.message}`);
    next(error);
  }
}

/**
 * UX8-01: log the account holder's explicit acknowledgment before "self" mode
 * (entering a prospect's clinical/psychological data on their behalf) proceeds
 * — this path previously had zero consent artifact at all. Self only; the
 * acting user's own id, never a client-supplied one.
 */
async function logSelfEntryConsent(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User ID not found' });
  }
  try {
    const { prospectName } = req.body;
    if (!prospectName) {
      return res.status(400).json({ success: false, error: 'Prospect name is required' });
    }
    const id = uuidv4();
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await db.query(
      `INSERT INTO self_entry_consents (id, user_id, prospect_name, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, prospectName, ip, userAgent]
    );
    return res.status(201).json({ success: true, id });
  } catch (error) {
    logger.error(`Failed to log self-entry consent: ${error.message}`);
    next(error);
  }
}

/**
 * Server-Sent Events stream for real-time status updates
 */
function streamInviteStatus(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!activeConnections.has(userId)) {
    activeConnections.set(userId, []);
  }
  activeConnections.get(userId).push(res);

  logger.info(`SSE client connected for user ${userId}. Active streams: ${activeConnections.get(userId).length}`);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Query latest invite status and push immediately on connection to prevent race conditions
  db.query('SELECT id, status FROM prospect_invites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])
    .then(result => {
      if (result.rows.length > 0) {
        const inv = result.rows[0];
        res.write(`data: ${JSON.stringify({ type: 'invite_update', inviteId: inv.id, status: inv.status })}\n\n`);
      }
    })
    .catch(err => {
      logger.error(`Failed to push initial invite status on SSE: ${err.message}`);
    });

  req.on('close', () => {
    const clients = activeConnections.get(userId) || [];
    const idx = clients.indexOf(res);
    if (idx !== -1) {
      clients.splice(idx, 1);
    }
    if (clients.length === 0) {
      activeConnections.delete(userId);
    }
    logger.info(`SSE client disconnected for user ${userId}`);
  });
}

/**
 * Get active invites for a user
 */
async function getInvites(req, res, next) {
  const userId = req.user?.id;
  try {
    const invitesRes = await db.query(
      `SELECT * FROM prospect_invites 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    return res.json(invitesRes.rows);
  } catch (error) {
    next(error);
  }
}

/**
 * Validate a token and return public details
 */
async function validateToken(req, res, next) {
  const { token } = req.params;
  try {
    const inviteRes = await db.query(
      `SELECT pi.*, u.name as inviter_name, u.gender as inviter_gender 
       FROM prospect_invites pi
       JOIN users u ON pi.user_id = u.id
       WHERE pi.token = $1`,
      [token]
    );

    const invite = inviteRes.rows[0];
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    if (new Date() > new Date(invite.expires_at)) {
      if (invite.status !== 'expired' && invite.status !== 'completed') {
        await db.query("UPDATE prospect_invites SET status = 'expired' WHERE id = $1", [invite.id]);
        broadcastInviteUpdate(invite.user_id, invite.id, 'expired');
      }
      return res.status(410).json({ success: false, error: 'Invitation has expired' });
    }

    if (invite.status === 'revoked') {
      return res.status(403).json({ success: false, error: 'Invitation has been revoked' });
    }

    if (invite.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Invitation has already been submitted' });
    }

    // Update status to opened/consent_pending if it was sent/delivered
    if (invite.status === 'sent' || invite.status === 'delivered') {
      await db.query("UPDATE prospect_invites SET status = 'opened' WHERE id = $1", [invite.id]);
      invite.status = 'opened';
      broadcastInviteUpdate(invite.user_id, invite.id, 'opened');
    }

    return res.json({
      success: true,
      invite: {
        id: invite.id,
        prospectName: invite.prospect_name,
        inviterName: invite.inviter_name,
        inviterGender: invite.inviter_gender,
        status: invite.status,
        expiresAt: invite.expires_at
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle consent acceptance or rejection
 */
async function updateConsent(req, res, next) {
  const { token, accepted } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown';

  try {
    const inviteRes = await db.query('SELECT * FROM prospect_invites WHERE token = $1', [token]);
    const invite = inviteRes.rows[0];
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    if (invite.status === 'completed' || invite.status === 'revoked') {
      return res.status(400).json({ success: false, error: 'Invalid invite status' });
    }

    const newStatus = accepted ? 'consent_accepted' : 'consent_rejected';
    
    await db.query(
      `UPDATE prospect_invites 
       SET status = $1, consent_timestamp = CURRENT_TIMESTAMP, consent_ip = $2, consent_user_agent = $3
       WHERE id = $4`,
      [newStatus, ip, ua, invite.id]
    );

    broadcastInviteUpdate(invite.user_id, invite.id, newStatus, {
      consent_timestamp: new Date(),
      consent_ip: ip
    });

    return res.json({ success: true, status: newStatus });
  } catch (error) {
    next(error);
  }
}

/**
 * Asynchronous background worker for processing pathology/radiology and performing matching
 */
async function processCompatibilityBackground(invite, explicitInviterPathologyId = null) {
  const inviteId = invite.id;
  const userId = invite.user_id; // the inviter user ID
  const prospectUserId = invite.prospect_user_id; // the prospect user ID
  const pathologyReportId = invite.pathology_report_id;

  try {
    // 1. Fetch prospect user and inviter user profiles
    const prospectRes = await db.query('SELECT * FROM users WHERE id = $1', [prospectUserId]);
    const prospect = prospectRes.rows[0];
    const inviterRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const inviter = inviterRes.rows[0];

    // 2. Fetch inviter's pathology report (either passed explicitly or from latest completed match)
    let inviterPathologyId = explicitInviterPathologyId;

    if (!inviterPathologyId) {
      const inviterPathRes = await db.query(
        `SELECT id, extracted_json FROM reports
         WHERE is_mock = FALSE
         AND id IN (SELECT male_report_id FROM matches WHERE user_id = $1 UNION SELECT female_report_id FROM matches WHERE user_id = $1)
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      inviterPathologyId = inviterPathRes.rows[0]?.id || null;
    }

    if (!inviterPathologyId) {
      // Never fabricate clinical data to fill this gap — a couple's real compatibility
      // result must never be partly computed from invented lab values. Fail clearly so
      // the inviter is prompted to complete their own real pathology report.
      throw new Error('Your pathology report must be uploaded and completed before you can run a compatibility match with your prospect.');
    }

    if (!pathologyReportId) {
      throw new Error('Prospect Pathology report must be present to compute compatibility');
    }

    const matchId = uuidv4();

    // --- Content-Driven Gender Resolution ---
    // Instead of trusting user profile gender (which can be stale or misconfigured),
    // inspect the actual parsed report content to determine which report belongs to
    // which biological sex. Falls back to profile gender if unresolvable.
    let inviterParsedData = null;
    let prospectParsedData = null;
    try {
      const inviterRepRes = await db.query("SELECT extracted_json::text FROM reports WHERE id = $1", [inviterPathologyId]);
      const prospectRepRes = await db.query("SELECT extracted_json::text FROM reports WHERE id = $1", [pathologyReportId]);
      inviterParsedData = inviterRepRes.rows[0]?.extracted_json ? JSON.parse(inviterRepRes.rows[0].extracted_json) : null;
      prospectParsedData = prospectRepRes.rows[0]?.extracted_json ? JSON.parse(prospectRepRes.rows[0].extracted_json) : null;
    } catch (parseErr) {
      logger.warn(`[processCompatibilityBackground] Could not parse reports for gender resolution: ${parseErr.message}`);
    }

    const inviterReportGender = resolveGenderRoleFromReport(inviterParsedData);
    const prospectReportGender = resolveGenderRoleFromReport(prospectParsedData);

    // Determine the canonical gender assignment:
    // If both resolve cleanly, use them directly. If one resolves, use that + its complement.
    // Otherwise fall back to profile gender.
    let isInviterMale;
    if (inviterReportGender === 'male' || prospectReportGender === 'female') {
      isInviterMale = true;
      logger.info('[processCompatibilityBackground] Content-resolved: inviter=MALE, prospect=FEMALE');
    } else if (inviterReportGender === 'female' || prospectReportGender === 'male') {
      isInviterMale = false;
      logger.info('[processCompatibilityBackground] Content-resolved: inviter=FEMALE, prospect=MALE');
    } else {
      // Fall back to profile gender
      isInviterMale = inviter.gender?.toLowerCase() === 'male';
      logger.warn(`[processCompatibilityBackground] Gender resolution fallback to profile: inviter.gender=${inviter.gender}`);
    }

    const maleReportId = isInviterMale ? inviterPathologyId : pathologyReportId;
    const femaleReportId = isInviterMale ? pathologyReportId : inviterPathologyId;

    // We can fetch details to compute score via chronic and mfr score routines
    const maleBmi = parseFloat((parseFloat(isInviterMale ? inviter.weight : prospect.weight) / Math.pow(parseFloat(isInviterMale ? inviter.height : prospect.height) / 100, 2)).toFixed(1));
    const femaleBmi = parseFloat((parseFloat(isInviterMale ? prospect.weight : inviter.weight) / Math.pow(parseFloat(isInviterMale ? prospect.height : inviter.height) / 100, 2)).toFixed(1));

    // Deliberately no bloodPressure/glucose/lipids/history fields here — those are
    // manual-override values, and chronic.controller.js's extractPatientData() treats
    // ANY truthy manual value as an override that wins over the real category it
    // auto-detects from the parsed pathology report. Hardcoding e.g. bloodPressure:
    // 'Normal' here would silently mask a real elevated/high reading the OCR pipeline
    // actually found. Leaving these fields out lets the real detected values through.
    const maleManual = {
      name: isInviterMale ? inviter.name : prospect.name,
      age: calculateAge(isInviterMale ? inviter.dob : prospect.dob),
      bmi: maleBmi,
      waist: classifyWaist(isInviterMale ? inviter.waist : prospect.waist, 'male')
    };

    const femaleManual = {
      name: isInviterMale ? prospect.name : inviter.name,
      age: calculateAge(isInviterMale ? prospect.dob : inviter.dob),
      bmi: femaleBmi,
      waist: classifyWaist(isInviterMale ? prospect.waist : inviter.waist, 'female')
    };

    const sharedLifestyle = {
      diet: inviter.drinking_habits === 'Never' && prospect.drinking_habits === 'Never' ? 'Healthy' : 'Mixed',
      activity: inviter.activity_level === 'Sedentary' || prospect.activity_level === 'Sedentary' ? 'Sedentary' : 'Active',
      smoking: inviter.smoking_habits === 'never' && prospect.smoking_habits === 'never' ? 'Never' : 'Occasional',
      drinking: inviter.drinking_habits === 'Never' && prospect.drinking_habits === 'Never' ? 'Never' : 'Occasional',
      sleep: inviter.sleep_cycle === 'irregular' || prospect.sleep_cycle === 'irregular' ? 'Irregular' : 'Normal',
      stress: 'Moderate'
    };


    // Run actual matching analyses using the Express controller handlers directly via mock req/res
    const mockReqChronic = {
      body: {
        male_report_id: maleReportId,
        female_report_id: femaleReportId,
        male_manual_data: maleManual,
        female_manual_data: femaleManual,
        shared_lifestyle_data: sharedLifestyle,
        match_id: matchId
      }
    };

    let chronicResultData = null;
    const mockResChronic = {
      json: (data) => { chronicResultData = data; },
      status: (code) => ({
        json: (d) => {
          logger.error(`[Background Match] Chronic analyze failed with code ${code}: ${JSON.stringify(d)}`);
        }
      })
    };

    await chronicController.analyzeChronic(mockReqChronic, mockResChronic, (err) => { throw err; });

    const mockReqMfr = {
      body: {
        male_report_id: maleReportId,
        female_report_id: femaleReportId,
        // No semenQuality/scrotalFinding/ovarianReserve here for the same reason as
        // maleManual/femaleManual above — mfr.controller.js treats any truthy manual
        // value as an override of the real classification it computes from the
        // parsed report's semen/AMH/AFC values, so hardcoding 'Normal' here would
        // silently mask a real abnormal finding.
        male_manual_data: {
          name: maleManual.name,
          age: maleManual.age
        },
        female_manual_data: {
          name: femaleManual.name,
          age: femaleManual.age
        },
        shared_lifestyle: {
          smoke: sharedLifestyle.smoking === 'Never' ? 0 : 0.5,
          bmi: isInviterMale ? (maleBmi > 25 ? 0.5 : 0) : (femaleBmi > 25 ? 0.5 : 0),
          act: sharedLifestyle.activity === 'Sedentary' ? 0.5 : 0,
          alc: sharedLifestyle.drinking === 'Never' ? 0 : 0.5,
          stress: 0.2,
          freq: 0.92,
          lifestyle_index: 85
        },
        barriers: {
          b_tubal: false,
          b_azoo: false,
          b_uterus: false
        },
        match_id: matchId
      }
    };

    let mfrResultData = null;
    const mockResMfr = {
      json: (data) => { mfrResultData = data; },
      status: (code) => ({
        json: (d) => {
          logger.error(`[Background Match] MFR analyze failed with code ${code}: ${JSON.stringify(d)}`);
        }
      })
    };

    await mfrController.analyzeMfr(mockReqMfr, mockResMfr, (err) => { throw err; });

    if (!chronicResultData || !mfrResultData) {
      throw new Error('Clinical matching engines returned empty results during background matching');
    }

    const inviterName = chronicResultData.partner_A?.name || maleManual.name || 'Partner A';
    const prospectName = chronicResultData.partner_B?.name || femaleManual.name || 'Partner B';

    // Only score mental compatibility when BOTH sides completed the full 21-question
    // survey — a partially-filled or missing side must not silently score as if
    // everyone answered positively across the board (same treatment as "didn't opt in").
    // `invite.mental_answers_json` is JSONB — pg already returns it parsed, never a
    // string; re-parsing it here (as an earlier version of this function did) throws
    // on every couple where the inviter had already answered, discarding both sides
    // silently via the catch below. Same bug class already fixed once in
    // `submitQuestionnaire`'s merge step — fixed here too.
    let mentalResult = null;
    if (invite.mental_answers_json) {
      try {
        const stored = invite.mental_answers_json;
        if (isMentalQuestionnaireComplete(stored.inviter) && isMentalQuestionnaireComplete(stored.prospect)) {
          mentalResult = await computeMentalResult(stored.inviter, stored.prospect, {
            cacheKey: `mental_insights_${matchId}`
          });
          // Data minimization: the score is retained in the match's own result;
          // the raw per-question answers don't need to live on indefinitely.
          await db.query('UPDATE prospect_invites SET mental_answers_json = NULL WHERE id = $1', [inviteId]);
        } else if (stored.inviter || stored.prospect) {
          logger.warn(`[Background Match] Mental health answers present but incomplete for invite ${inviteId} — skipping mental scoring for now (kept so either side can still finish it later).`);
        }
      } catch (mentalErr) {
        logger.error(`[Background Match] Mental health scoring failed: ${mentalErr.message}`);
      }
    }

    // Compile and save/update the match record in DB
    await reportGenerationService.compileMatchReport(matchId, {
      userId,
      maleReportId,
      femaleReportId,
      chronicResult: chronicResultData,
      mfrResult: mfrResultData,
      mentalResult,
      maleManual,
      femaleManual,
      sharedLifestyle,
      inviterName,
      prospectName
    });

    // Update invite to completed
    await db.query("UPDATE prospect_invites SET status = 'completed' WHERE id = $1", [inviteId]);
    broadcastInviteUpdate(userId, inviteId, 'completed', { matchId });

  } catch (error) {
    logger.error(`Error during background compatibility analysis for invite ${inviteId}: ${error.message}`);
    await db.query("UPDATE prospect_invites SET status = 'failed' WHERE id = $1", [inviteId]);
    broadcastInviteUpdate(userId, inviteId, 'failed', { error: error.message });
  }
}

/**
 * Handle questionnaire submission from prospect
 */
async function submitQuestionnaire(req, res, next) {
  const { token } = req.body;
  const files = req.files || {};

  try {
    const inviteRes = await db.query('SELECT * FROM prospect_invites WHERE token = $1', [token]);
    const invite = inviteRes.rows[0];
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    if (new Date() > new Date(invite.expires_at)) {
      return res.status(410).json({ success: false, error: 'Invitation has expired' });
    }

    if (invite.status === 'completed' || invite.status === 'revoked') {
      return res.status(400).json({ success: false, error: 'Invalid invite status' });
    }

    // Save filled questionnaire metrics to prospect user record
    const {
      dob,
      city,
      height,
      weight,
      waist,
      activity_level,
      drinking_habits,
      smoking_habits,
      sleep_cycle
    } = req.body;

    await db.query(
      `UPDATE users
       SET dob = $1, city = $2, height = $3, weight = $4, waist = $5,
           activity_level = $6,
           drinking_habits = $7, smoking_habits = $8, sleep_cycle = $9
       WHERE id = $10`,
      [
        dob, city, parseFloat(height), parseFloat(weight), parseFloat(waist),
        activity_level,
        drinking_habits, smoking_habits, sleep_cycle,
        invite.prospect_user_id
      ]
    );

    let pathologyReportId = null;
    let radiologyReportId = null;

    // 1. Process Pathology Report PDF if uploaded
    if (files.pathologyReport && files.pathologyReport[0]) {
      const pathFile = files.pathologyReport[0];
      const pathId = uuidv4();
      pathologyReportId = pathId;

      logger.info(`OCR processing for pathology: ${pathFile.path}`);
      // Save initial placeholder
      await db.query(`
        INSERT INTO reports (id, file_name, processing_status, confidence_score) 
        VALUES ($1, $2, $3, $4)
      `, [pathId, pathFile.originalname, 'processing', 0.0]);

      // OCR & Extraction
      const ocrPages = await ocrProvider.process(pathFile.path);
      if (ocrPages.length > 0) {
        const values = [];
        const valuePlaceholders = [];
        ocrPages.forEach((page, idx) => {
          values.push(pathId, page.page, page.text);
          const offset = idx * 3;
          valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        });
        await db.query(`
          INSERT INTO ocr_pages (report_id, page_number, raw_text)
          VALUES ${valuePlaceholders.join(', ')}
        `, values);
      }

      const extractedData = parameterExtractor.extract(ocrPages);
      await db.query(`
        UPDATE reports SET processing_status = $1, confidence_score = $2, extracted_json = $3 WHERE id = $4
      `, ['completed', 0.95, JSON.stringify(extractedData), pathId]);

      // Unlink temp path
      try { fs.unlinkSync(pathFile.path); } catch (e) {}
    } else if (req.body.useMockPathology === 'true') {
      const pathId = uuidv4();
      pathologyReportId = pathId;
      const extractedData = {
        cbc: {
          hemoglobin: { value: 14.5, unit: 'g/dL', reference_range: '12.0-16.0', confidence: 0.98 },
          total_rbc_count: { value: 4.2, unit: 'mill/uL', reference_range: '4.0-5.2', confidence: 0.94 }
        }
      };
      await db.query(`
        INSERT INTO reports (id, file_name, processing_status, confidence_score, extracted_json, is_mock)
        VALUES ($1, $2, $3, $4, $5, TRUE)
      `, [pathId, 'mock_pathology.pdf', 'completed', 0.96, JSON.stringify(extractedData)]);
    }

    // 2. Process Radiology Report PDF if uploaded
    if (files.radiologyReport && files.radiologyReport[0]) {
      const radFile = files.radiologyReport[0];
      const radId = uuidv4();
      radiologyReportId = radId;

      logger.info(`OCR processing for radiology: ${radFile.path}`);
      const ocrResults = await ocrSpaceService.process(radFile.path);
      const rawText = ocrResults.map(p => p.text).join('\n\n');

      const analyzed = await radiologyController.runRadiologyAnalysis(
        rawText, 
        req.body.gender || 'Female', 
        calculateAge(dob) || 30, 
        invite.prospect_name, 
        parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)
      );

      await db.query(
        `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          radId,
          analyzed.patient_slay_id,
          analyzed.sex,
          analyzed.age,
          analyzed.modalities_detected,
          JSON.stringify(analyzed.findings),
          JSON.stringify(analyzed.scores),
          JSON.stringify(analyzed.risk_flags),
          analyzed.raw_ocr_text,
          userId
        ]
      );

      try { fs.unlinkSync(radFile.path); } catch (e) {}
    } else if (req.body.useMockRadiology === 'true') {
      const radId = uuidv4();
      radiologyReportId = radId;
      const sexVal = req.body.gender || 'Female';
      const ageVal = calculateAge(dob) || 30;

      const mockFindings = {
        USG_ABDOMEN: {
          liver: { fatty_grade: 0, hepatomegaly: false, ihbr_dilated: false, focal_lesions: [] },
          gallbladder: { present: true, calculi_present: false, polyp_present: false, wall_thickness_normal: true }
        }
      };

      await db.query(
        `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text, is_mock, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)`,
        [
          radId,
          invite.prospect_name,
          sexVal,
          ageVal,
          ['USG_ABDOMEN'],
          JSON.stringify(mockFindings),
          JSON.stringify({ organ_scores: { USG_ABDOMEN: 95.0 }, radiology_nuptia_contribution: 27.5 }),
          JSON.stringify([]),
          'MOCK PREMARITAL PORTAL UPLOAD',
          userId
        ]
      );
    }

    // Merge prospect's mental-health answers (if any) into whatever the inviter already stored.
    // invite.mental_answers_json comes back from `pg` already parsed (it's a JSONB column, not
    // TEXT) — re-running JSON.parse on it threw on every couple where the inviter had already
    // answered, silently discarding the prospect's real submission via the catch below.
    let mentalAnswersJson = invite.mental_answers_json;
    if (req.body.mentalAnswers) {
      try {
        const prospectMentalAnswers = JSON.parse(req.body.mentalAnswers);
        if (prospectMentalAnswers && Object.keys(prospectMentalAnswers).length > 0) {
          const existing = invite.mental_answers_json || {};
          mentalAnswersJson = JSON.stringify({ ...existing, prospect: prospectMentalAnswers });
        }
      } catch (e) {
        logger.error(`Failed to parse prospect mentalAnswers: ${e.message}`);
      }
    }

    // Update invite status to submitted and store report IDs
    await db.query(
      `UPDATE prospect_invites
       SET status = 'questionnaire_submitted', pathology_report_id = $1, radiology_report_id = $2, mental_answers_json = $3
       WHERE id = $4`,
      [pathologyReportId, radiologyReportId, mentalAnswersJson, invite.id]
    );
    broadcastInviteUpdate(invite.user_id, invite.id, 'questionnaire_submitted');

    return res.json({
      success: true,
      message: 'Questionnaire submitted successfully.'
    });

  } catch (error) {
    logger.error(`Error in questionnaire submit: ${error.message}`);
    // Clean up uploaded files in request on failure
    if (files) {
      Object.keys(files).forEach(fieldName => {
        files[fieldName].forEach(file => {
          try { fs.unlinkSync(file.path); } catch (e) {}
        });
      });
    }
    next(error);
  }
}

/**
 * Manually trigger AI Compatibility match analysis
 */
async function runInviteMatch(req, res, next) {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const inviteRes = await db.query('SELECT * FROM prospect_invites WHERE id = $1 AND user_id = $2', [id, userId]);
    const invite = inviteRes.rows[0];
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found or unauthorized' });
    }

    if (invite.status !== 'questionnaire_submitted' && invite.status !== 'failed') {
      return res.status(400).json({ success: false, error: 'Cannot run match scan: questionnaire must be submitted first' });
    }

    const { inviterPathologyId } = req.body;

    // Atomic compare-and-swap: only proceed if THIS request is the one that actually
    // transitions the invite out of a runnable status. Without this, a double-click or
    // a client retry racing another in-flight request could both pass the status check
    // above, both flip to 'processing', and both kick off a duplicate (and separately
    // paid-for) background match.
    const claimRes = await db.query(
      `UPDATE prospect_invites SET status = 'processing'
       WHERE id = $1 AND status IN ('questionnaire_submitted', 'failed')
       RETURNING id`,
      [id]
    );
    if (claimRes.rowCount === 0) {
      return res.status(409).json({ success: false, error: 'A match scan is already running or was already started for this invite.' });
    }
    broadcastInviteUpdate(userId, id, 'processing');

    // Run the matching worker in the background
    processCompatibilityBackground(invite, inviterPathologyId);

    return res.json({ success: true, message: 'Health compatibility scan initiated.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Manually revoke an invite
 */
async function revokeInvite(req, res, next) {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const inviteRes = await db.query('SELECT * FROM prospect_invites WHERE id = $1 AND user_id = $2', [id, userId]);
    const invite = inviteRes.rows[0];
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found or unauthorized' });
    }

    await db.query("UPDATE prospect_invites SET status = 'revoked' WHERE id = $1", [id]);
    broadcastInviteUpdate(userId, id, 'revoked');

    return res.json({ success: true, message: 'Invitation successfully revoked' });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle incoming WhatsApp status webhook events
 */
async function handleWhatsAppWebhook(req, res, next) {
  try {
    const { body } = req;
    
    // Webhook verification challenge
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'slayhealth_webhook_verify_token';
      
      if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
          logger.info('WhatsApp webhook verified.');
          return res.status(200).send(challenge);
        } else {
          return res.sendStatus(403);
        }
      }
      return res.sendStatus(400);
    }

    // Webhook post handler
    if (body.object === 'whatsapp_business_account') {
      const value = body.entry?.[0]?.changes?.[0]?.value;

      if (value?.statuses) {
        const statusObj = value.statuses[0];
        const msgId = statusObj.id;
        const wsStatus = statusObj.status; // 'sent', 'delivered', 'read', 'failed'

        logger.info(`WhatsApp Webhook event: msgId=${msgId}, status=${wsStatus}`);
        await whatsappMessageLog.updateStatusByWaMessageId(msgId, wsStatus);

        // Find invite matching this message ID
        const inviteRes = await db.query('SELECT * FROM prospect_invites WHERE whatsapp_message_id = $1', [msgId]);
        const invite = inviteRes.rows[0];

        if (invite) {
          // Map WhatsApp status to invite lifecycle state
          let newStatus = invite.status;
          if (wsStatus === 'delivered' && invite.status === 'sent') {
            newStatus = 'delivered';
          } else if (wsStatus === 'read' && (invite.status === 'sent' || invite.status === 'delivered')) {
            newStatus = 'opened';
          } else if (wsStatus === 'failed') {
            newStatus = 'failed';
          }

          if (newStatus !== invite.status) {
            await db.query('UPDATE prospect_invites SET status = $1 WHERE id = $2', [newStatus, invite.id]);
            broadcastInviteUpdate(invite.user_id, invite.id, newStatus);
          }
        }
      }

      // Real incoming replies from users — previously received by this webhook and
      // silently dropped (only `statuses` was ever handled), so nothing sent to the
      // business number was ever visible anywhere. Logged as-is; nothing here acts on
      // the content, this is purely for the admin message viewer.
      if (value?.messages) {
        const msg = value.messages[0];
        let bodyText = null;
        if (msg.type === 'text') bodyText = msg.text?.body;
        else if (msg.type === 'button') bodyText = msg.button?.text;
        else if (msg.type === 'interactive') bodyText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title;
        else bodyText = `[${msg.type} message]`;

        logger.info(`WhatsApp inbound message from ${msg.from}: ${bodyText}`);
        await whatsappMessageLog.logInbound({
          from: msg.from,
          messageType: msg.type,
          bodyText,
          waMessageId: msg.id,
          rawPayload: msg
        });
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    logger.error(`Error in WhatsApp Webhook handler: ${error.message}`);
    return res.status(500).send('Webhook handler error');
  }
}

module.exports = {
  createInvite,
  logSelfEntryConsent,
  streamInviteStatus,
  getInvites,
  validateToken,
  updateConsent,
  submitQuestionnaire,
  revokeInvite,
  runInviteMatch,
  handleWhatsAppWebhook
};
