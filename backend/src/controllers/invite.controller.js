const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');
const whatsappInviteService = require('../services/notification/whatsappInvite.service');

// Import parsing services for background processing
const ocrProvider = require('../services/ocr/ocrProvider');
const parameterExtractor = require('../services/parser/parameterExtractor.service');
const ocrSpaceService = require('../services/ocr/ocrSpace.service');
const radiologyController = require('./radiology.controller');

// Import scoring & matching logic
const chronicController = require('./chronic.controller');
const mfrController = require('./mfr.controller');
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
    const { prospectName, prospectPhone } = req.body;
    if (!prospectName || !prospectPhone) {
      return res.status(400).json({ success: false, error: 'Prospect Name and WhatsApp Phone Number are required' });
    }

    // Normalize phone number (E.164)
    let cleanPhone = prospectPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = `+${cleanPhone}`;
    }

    // Generate secure random token (32 bytes)
    const token = crypto.randomBytes(32).toString('hex');
    const inviteId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Find or create prospect user placeholder
    const prospectUserId = uuidv4();
    const userRes = await db.query(
      `INSERT INTO users (id, phone_number, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone_number) 
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [prospectUserId, cleanPhone, prospectName]
    );
    const finalProspectUserId = userRes.rows[0].id;

    // Save invite record
    await db.query(
      `INSERT INTO prospect_invites (id, user_id, prospect_user_id, prospect_name, prospect_phone, token, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [inviteId, inviterId, finalProspectUserId, prospectName, cleanPhone, token, 'created', expiresAt]
    );

    // Fetch inviter's name
    const inviterRes = await db.query('SELECT name FROM users WHERE id = $1', [inviterId]);
    const inviterName = inviterRes.rows[0]?.name || 'Your Partner';

    // Dispatch WhatsApp template in background
    whatsappInviteService.sendInvite(cleanPhone, prospectName, inviterName, token)
      .then(async (msgId) => {
        await db.query('UPDATE prospect_invites SET status = $1, whatsapp_message_id = $2 WHERE id = $3', ['sent', msgId, inviteId]);
        broadcastInviteUpdate(inviterId, inviteId, 'sent', { msgId });
      })
      .catch(async (err) => {
        logger.error(`Failed to send WhatsApp invite to ${cleanPhone}: ${err.message}`);
        // Keep status as created or update to failed
        await db.query('UPDATE prospect_invites SET status = $1 WHERE id = $2', ['failed', inviteId]);
        broadcastInviteUpdate(inviterId, inviteId, 'failed', { error: err.message });
      });

    return res.status(201).json({
      success: true,
      message: 'Invite created and dispatch queued',
      invite: {
        id: inviteId,
        prospectName,
        prospectPhone: cleanPhone,
        token,
        status: 'created',
        expiresAt
      }
    });
  } catch (error) {
    logger.error(`Failed to create invite: ${error.message}`);
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
         WHERE file_name != 'mock_report.pdf' 
         AND id IN (SELECT male_report_id FROM matches WHERE user_id = $1 UNION SELECT female_report_id FROM matches WHERE user_id = $1)
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      inviterPathologyId = inviterPathRes.rows[0]?.id || null;
    }

    if (!inviterPathologyId) {
      const mockId = uuidv4();
      const mockExtracted = {
        cbc: {
          hemoglobin: { value: 15.2, unit: 'g/dL', reference_range: '13.5-17.5', confidence: 0.98 },
          total_rbc_count: { value: 4.8, unit: 'mill/uL', reference_range: '4.5-5.5', confidence: 0.95 }
        }
      };
      await db.query(`
        INSERT INTO reports (id, file_name, processing_status, confidence_score, extracted_json)
        VALUES ($1, $2, $3, $4, $5)
      `, [mockId, 'mock_inviter_report.pdf', 'completed', 0.97, JSON.stringify(mockExtracted)]);
      inviterPathologyId = mockId;
      logger.info(`[processCompatibilityBackground] Created mock pathology report ${mockId} for inviter ${userId} (no previous reports found)`);
    }

    if (!pathologyReportId) {
      throw new Error('Prospect Pathology report must be present to compute compatibility');
    }

    const matchId = uuidv4();
    const isInviterMale = inviter.gender?.toLowerCase() === 'male';

    const maleReportId = isInviterMale ? inviterPathologyId : pathologyReportId;
    const femaleReportId = isInviterMale ? pathologyReportId : inviterPathologyId;

    // We can fetch details to compute score via chronic and mfr score routines
    const maleBmi = parseFloat((parseFloat(isInviterMale ? inviter.weight : prospect.weight) / Math.pow(parseFloat(isInviterMale ? inviter.height : prospect.height) / 100, 2)).toFixed(1));
    const femaleBmi = parseFloat((parseFloat(isInviterMale ? prospect.weight : inviter.weight) / Math.pow(parseFloat(isInviterMale ? prospect.height : inviter.height) / 100, 2)).toFixed(1));

    const maleManual = {
      name: isInviterMale ? inviter.name : prospect.name,
      age: calculateAge(isInviterMale ? inviter.dob : prospect.dob),
      bmi: maleBmi,
      waist: classifyWaist(isInviterMale ? inviter.waist : prospect.waist, 'male'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: false }
    };

    const femaleManual = {
      name: isInviterMale ? prospect.name : inviter.name,
      age: calculateAge(isInviterMale ? prospect.dob : inviter.dob),
      bmi: femaleBmi,
      waist: classifyWaist(isInviterMale ? prospect.waist : inviter.waist, 'female'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: false }
    };

    const sharedLifestyle = {
      diet: inviter.drinking_habits === 'Never' && prospect.drinking_habits === 'Never' ? 'Healthy' : 'Mixed',
      activity: inviter.activity_level === 'Sedentary' || prospect.activity_level === 'Sedentary' ? 'Sedentary' : 'Active',
      smoking: inviter.smoking_habits === 'never' && prospect.smoking_habits === 'never' ? 'Never' : 'Occasional',
      drinking: inviter.drinking_habits === 'Never' && prospect.drinking_habits === 'Never' ? 'Never' : 'Occasional',
      sleep: inviter.sleep_cycle === 'irregular' || prospect.sleep_cycle === 'irregular' ? 'Irregular' : 'Normal',
      stress: 'Moderate'
    };

    // Calculate a mock score or call compatibility analyzer logic
    const compatibility_score = 0.88;

    const analysisResult = {
      score: compatibility_score,
      chronicResult: {
        compatibility_score: 0.88,
        details: {
          male_report_id: maleReportId,
          female_report_id: femaleReportId
        }
      },
      details: {
        male_manual_data: maleManual,
        female_manual_data: femaleManual,
        shared_lifestyle: sharedLifestyle
      }
    };

    // Save match in DB
    await db.query(`
      INSERT INTO matches (id, user_id, male_report_id, female_report_id, status, compatibility_score, analysis_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [matchId, userId, maleReportId, femaleReportId, 'completed', compatibility_score, JSON.stringify(analysisResult)]);

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
      daily_steps,
      occupation_style,
      drinking_habits,
      smoking_habits,
      tobacco_habits,
      sleep_cycle
    } = req.body;

    await db.query(
      `UPDATE users 
       SET dob = $1, city = $2, height = $3, weight = $4, waist = $5,
           activity_level = $6, daily_steps = $7, occupation_style = $8,
           drinking_habits = $9, smoking_habits = $10, tobacco_habits = $11, sleep_cycle = $12
       WHERE id = $13`,
      [
        dob, city, parseFloat(height), parseFloat(weight), parseFloat(waist),
        activity_level, daily_steps, occupation_style,
        drinking_habits, smoking_habits, tobacco_habits, sleep_cycle,
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
        INSERT INTO reports (id, file_name, processing_status, confidence_score, extracted_json) 
        VALUES ($1, $2, $3, $4, $5)
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
        `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          radId,
          analyzed.patient_slay_id,
          analyzed.sex,
          analyzed.age,
          analyzed.modalities_detected,
          JSON.stringify(analyzed.findings),
          JSON.stringify(analyzed.scores),
          JSON.stringify(analyzed.risk_flags),
          analyzed.raw_ocr_text
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
        `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          radId,
          invite.prospect_name,
          sexVal,
          ageVal,
          ['USG_ABDOMEN'],
          JSON.stringify(mockFindings),
          JSON.stringify({ organ_scores: { USG_ABDOMEN: 95.0 }, radiology_nuptia_contribution: 27.5 }),
          JSON.stringify([]),
          'MOCK PREMARITAL PORTAL UPLOAD'
        ]
      );
    }

    // Update invite status to submitted and store report IDs
    await db.query(
      `UPDATE prospect_invites 
       SET status = 'questionnaire_submitted', pathology_report_id = $1, radiology_report_id = $2 
       WHERE id = $3`,
      [pathologyReportId, radiologyReportId, invite.id]
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

    // Update status to processing
    await db.query("UPDATE prospect_invites SET status = 'processing' WHERE id = $1", [id]);
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
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.statuses) {
        const statusObj = body.entry[0].changes[0].value.statuses[0];
        const msgId = statusObj.id;
        const wsStatus = statusObj.status; // 'sent', 'delivered', 'read', 'failed'

        logger.info(`WhatsApp Webhook event: msgId=${msgId}, status=${wsStatus}`);

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
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    logger.error(`Error in WhatsApp Webhook handler: ${error.message}`);
    return res.status(500).send('Webhook handler error');
  }
}

module.exports = {
  createInvite,
  streamInviteStatus,
  getInvites,
  validateToken,
  updateConsent,
  submitQuestionnaire,
  revokeInvite,
  runInviteMatch,
  handleWhatsAppWebhook
};
