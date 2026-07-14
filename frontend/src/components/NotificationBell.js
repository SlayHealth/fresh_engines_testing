'use client';

import { useState, useEffect, useRef } from 'react';
import Ico from './mobile/Ico';
import { API_URL } from '../config/api';
import { apiFetch, getAccessToken } from '../utils/api';

// Real invite-status events only — no fabricated notification types. Backed
// by the existing GET /api/invite/status (history) + GET /api/invite/stream
// (live SSE, already broadcasting these exact statuses account-wide via
// broadcastInviteUpdate) — both pre-existing, built for the desktop invite
// flow, reused here rather than duplicated.
const STATUS_TEXT = {
  sent: (name) => `Invite sent to ${name}`,
  opened: (name) => `${name} opened your invite`,
  questionnaire_submitted: (name) => `${name} completed their questionnaire`,
  processing: (name) => `Compiling your report with ${name}…`,
  completed: (name) => `Your compatibility check with ${name} is ready`,
  failed: (name) => `Something went wrong compiling your report with ${name}`,
  expired: (name) => `Your invite to ${name} expired`,
  revoked: (name) => `You revoked your invite to ${name}`
};

function describeInvite(invite) {
  const name = invite.prospect_name || 'Your prospect';
  const fn = STATUS_TEXT[invite.status];
  return fn ? fn(name) : `${name}: ${invite.status}`;
}

function seenKey(userId) {
  return `slayhealth_seen_invite_events_${userId}`;
}

function loadSeen(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(userId)) || '[]')); } catch (e) { return new Set(); }
}

function saveSeen(userId, set) {
  try { localStorage.setItem(seenKey(userId), JSON.stringify([...set])); } catch (e) { /* best-effort only */ }
}

export default function NotificationBell({ userId }) {
  const [invites, setInvites] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [seen, setSeen] = useState(() => loadSeen(userId));
  const sourceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch(`${API_URL}/api/invite/status`)
      .then((res) => res.json())
      .then((rows) => { if (!cancelled) setInvites(Array.isArray(rows) ? rows : []); })
      .catch(() => {});

    // EventSource can't send an Authorization header, but authenticateToken
    // already accepts ?token= as a fallback (same mechanism the in-app PDF
    // download link uses) — safe here since it's the real, short-lived access
    // token for the user's own live session, not a shared/exported link.
    const token = getAccessToken();
    let source;
    if (token) {
      source = new EventSource(`${API_URL}/api/invite/stream?token=${token}`);
      source.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch (err) { return; }
        if (data.type !== 'invite_update') return;
        setInvites((prev) => {
          const idx = prev.findIndex((i) => i.id === data.inviteId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], status: data.status };
          return next;
        });
      };
      sourceRef.current = source;
    }

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [userId]);

  const eventKey = (i) => `${i.id}:${i.status}`;
  const unreadCount = invites.filter((i) => !seen.has(eventKey(i))).length;

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && invites.length > 0) {
      const nextSeen = new Set(seen);
      invites.forEach((i) => nextSeen.add(eventKey(i)));
      setSeen(nextSeen);
      saveSeen(userId, nextSeen);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleToggle}
        className="iconbtn"
        style={{ position: 'relative', zIndex: 50 }}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'}
      >
        <Ico name="bell" />
        {unreadCount > 0 && <i className="dot" />}
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsOpen(false)} />
          <div
            className="card"
            style={{ position: 'absolute', right: 0, top: 44, zIndex: 50, width: 288, maxHeight: 340, overflowY: 'auto' }}
          >
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
              <p className="eyebrow" style={{ color: 'var(--ink-3)' }}>Invite activity</p>
            </div>
            {invites.length === 0 ? (
              <p style={{ padding: '22px 14px', fontSize: 12, textAlign: 'center', color: 'var(--ink-3)' }}>No invite activity yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {invites.map((i) => (
                  <li key={i.id} style={{ padding: '11px 14px', borderTop: '1px solid var(--line-2)' }}>
                    <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--ink)', margin: 0 }}>{describeInvite(i)}</p>
                    <p style={{ fontSize: 10.5, marginTop: 2, color: 'var(--ink-3)' }}>
                      Sent {new Date(i.created_at).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
