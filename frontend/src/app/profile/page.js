'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Sparkles, Activity, MessageSquare, MessageCircle, ScanLine, Dna, ChevronRight, Trash2, Settings } from 'lucide-react';
import { useCompatibility, calculateAge } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ConfirmDialog';
import CityInput from '../../components/wizard/CityInput';
import { GENDERS } from '../../constants/lifestyleOptions';
import useIsMobile from '../../hooks/useIsMobile';
import Ico from '../../components/mobile/Ico';

const fieldClass = 'w-full p-3 border rounded-xl outline-none text-sm';
const fieldStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

// Draft persistence for in-progress profile edits — this form previously lived
// only in useState, so navigating away or a refresh mid-edit silently dropped
// whatever hadn't been explicitly saved yet. Same pattern as the questionnaire/
// radiology drafts in CompatibilityContext.js / add-prospect/page.js: namespaced
// per logged-in user id (read directly out of localStorage, not the `user`
// state, since that's only populated asynchronously after mount), cleared once
// a save actually lands on the server so a stale draft can never shadow it.
let cachedProfileEditDraft;

function getStoredUserId() {
  try {
    const raw = localStorage.getItem('slayhealth_user');
    return raw ? JSON.parse(raw)?.id : null;
  } catch (e) {
    return null;
  }
}

function profileEditDraftKey() {
  return `slayhealth_profile_edit_draft_${getStoredUserId() || 'anon'}`;
}

function loadProfileEditDraft() {
  if (cachedProfileEditDraft !== undefined) return cachedProfileEditDraft;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(profileEditDraftKey()) : null;
    cachedProfileEditDraft = raw ? JSON.parse(raw) : null;
  } catch (e) {
    cachedProfileEditDraft = null;
  }
  return cachedProfileEditDraft;
}

function clearProfileEditDraft() {
  try {
    localStorage.removeItem(profileEditDraftKey());
  } catch (e) {
    // localStorage unavailable — nothing to clean up
  }
  cachedProfileEditDraft = undefined;
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>{label}</label>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser, runsUsed, chatsUsed, handleLogout } = useCompatibility();
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mobileEditing, setMobileEditing] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    if (user && !form) {
      // A saved draft means genuinely unsaved local edits from before a refresh —
      // those take priority over the server's copy of each field individually
      // (not wholesale), so a draft that only touched "city" doesn't clobber a
      // "name" that's actually more current on the server.
      const draft = loadProfileEditDraft();
      setForm({
        name: draft?.name ?? user.name ?? '',
        gender: draft?.gender ?? user.gender ?? '',
        dob: draft?.dob ?? user.dob ?? '',
        city: draft?.city ?? user.city ?? '',
        height: draft?.height ?? user.height ?? '',
        weight: draft?.weight ?? user.weight ?? '',
        waist: draft?.waist ?? user.waist ?? ''
      });
    }
  }, [user, form]);

  // Mirror every edit into localStorage so backgrounding the tab, an accidental
  // navigation, or the OS killing the tab never silently drops in-progress edits.
  useEffect(() => {
    if (!form) return;
    try {
      localStorage.setItem(profileEditDraftKey(), JSON.stringify(form));
    } catch (e) {
      // Storage full/unavailable — draft persistence is best-effort only.
    }
  }, [form]);

  if (!user || !form) return null;

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // updateProfile overwrites every field it's sent — this page only edits Personal
      // Details/Body Metrics, so pass the user's existing lifestyle values through
      // unchanged rather than omitting them (omitting would null them out server-side).
      const res = await apiFetch(`${API_URL}/api/auth/profile`, {
        method: 'POST',
        body: JSON.stringify({
          id: user.id,
          ...form,
          activity_level: user.activity_level,
          drinking_habits: user.drinking_habits,
          smoking_habits: user.smoking_habits,
          sleep_cycle: user.sleep_cycle
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save your profile');
      localStorage.setItem('slayhealth_user', JSON.stringify(data.user));
      setUser(data.user);
      clearProfileEditDraft();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message || 'Failed to save your profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutClick = async () => {
    const ok = await confirmDialog({
      title: 'Log out?',
      message: "You'll need to verify your phone number again to sign back in.",
      confirmLabel: 'Log out',
      danger: true
    });
    if (!ok) return;
    await handleLogout();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    const ok = await confirmDialog({
      title: 'Delete account & data?',
      message: "This permanently deletes your account, saved health reports, compatibility checks, and chat history — this cannot be undone. Note: a small number of older radiology/ultrasound uploads from before account-linking was added may not be automatically removed.",
      confirmLabel: 'Delete everything',
      danger: true
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/account`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete your account');
      await handleLogout();
      router.push('/');
    } catch (err) {
      toast.error(err.message || 'Failed to delete your account');
      setIsDeleting(false);
    }
  };

  const scansLeft = Math.max(0, 1 - runsUsed);
  const chatsLeft = Math.max(0, 5 - chatsUsed);
  const initial = user.name ? user.name[0].toUpperCase() : 'U';

  if (isMobile === undefined) return null;

  if (isMobile) {
    return (
      <div className="mshell" data-mtheme="light" style={{ minHeight: '100dvh' }}>
        <main className="scroll" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
          <h1 className="vtitle serif">Account</h1>

          <div className="phead card">
            <div className="av">{initial}</div>
            <div>
              <b className="serif">{user.name || 'User'}</b>
              <small>{user.phone_number}{user.dob ? ` · ${calculateAge(user.dob)}` : ''}{user.gender ? ` · ${user.gender}` : ''}{user.city ? ` · ${user.city}` : ''}</small>
            </div>
          </div>

          <div className="plan grain">
            <div className="p-top"><b className="serif">Free plan</b></div>
            <div className="p-row">
              <div className="p-m"><span>Scans · {scansLeft} of 1 left</span><div className="mb"><i style={{ width: `${scansLeft * 100}%` }} /></div></div>
              <div className="p-m"><span>AI chats · {chatsLeft} of 5 left</span><div className="mb"><i style={{ width: `${(chatsLeft / 5) * 100}%` }} /></div></div>
            </div>
            <button onClick={() => router.push('/add-prospect?enter=radiology')}>Upgrade for radiology + genomics</button>
          </div>

          {mobileEditing ? (
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div className="space-y-3">
                <Field label="Name"><input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} className={fieldClass} style={fieldStyle} /></Field>
                <Field label="Gender">
                  <select value={form.gender} onChange={(e) => set({ gender: e.target.value })} className={fieldClass} style={fieldStyle}>
                    <option value="">Select…</option>
                    {GENDERS.map((g) => <option key={g.val} value={g.val}>{g.label}</option>)}
                  </select>
                </Field>
                <Field label="Date of Birth"><input type="date" value={form.dob} onChange={(e) => set({ dob: e.target.value })} className={fieldClass} style={fieldStyle} /></Field>
                <Field label="City"><CityInput value={form.city} onChange={(v) => set({ city: v })} /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Height (cm)"><input type="number" value={form.height} onChange={(e) => set({ height: e.target.value })} className={fieldClass} style={fieldStyle} /></Field>
                  <Field label="Weight (kg)"><input type="number" value={form.weight} onChange={(e) => set({ weight: e.target.value })} className={fieldClass} style={fieldStyle} /></Field>
                  <Field label="Waist (in)"><input type="number" value={form.waist} onChange={(e) => set({ waist: e.target.value })} className={fieldClass} style={fieldStyle} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => setMobileEditing(false)} style={{ flex: 1, height: 44, borderRadius: 13, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13.5 }}>Done</button>
                  <button onClick={handleSave} disabled={isSaving} style={{ flex: 1, height: 44, borderRadius: 13, background: 'var(--h-teal)', color: '#fff', fontWeight: 600, fontSize: 13.5, opacity: isSaving ? 0.6 : 1 }}>{isSaving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
            </div>
          ) : (
            <ul className="plist">
              <li><button onClick={() => setMobileEditing(true)}><Ico name="user" /><b>Personal details</b><Ico name="chev" className="chevron" /></button></li>
              <li><button onClick={() => router.push('/dashboard')}><Ico name="file" /><b>Reports &amp; downloads</b><Ico name="chev" className="chevron" /></button></li>
              <li><button onClick={() => toast.info('Your data is encrypted and never shared without your consent.')}><Ico name="shield" /><b>Privacy &amp; data</b><Ico name="chev" className="chevron" /></button></li>
              <li><button onClick={() => toast.info('DPDP compliance coming soon.')}><Ico name="gear" /><b>Settings</b><Ico name="chev" className="chevron" /></button></li>
            </ul>
          )}

          <ul className="plist">
            <li><button onClick={handleLogoutClick}><Ico name="out" /><b>Sign out</b></button></li>
            <li><button className="danger" onClick={handleDeleteAccount} disabled={isDeleting}><Ico name="trash" /><b>{isDeleting ? 'Deleting…' : 'Delete account & data'}</b></button></li>
          </ul>
        </main>
      </div>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-6 pb-24 lg:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 hover:bg-black/5"
            style={{ color: 'var(--muted)' }}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <h1 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>Profile</h1>
        </div>

        {/* Identity card */}
        <div className="rounded-2xl border p-4 flex items-center gap-3 mb-6" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-serif font-semibold text-lg shrink-0"
            style={{ background: 'var(--pink)' }}
          >
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-base font-semibold truncate" style={{ color: 'var(--ink)' }}>{user.name || 'User'}</p>
            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{user.phone_number}</p>
          </div>
        </div>

        {/* Quota strip — read-only account usage */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}>
            <Activity className="w-3 h-3" />
            {Math.max(0, 1 - runsUsed)}/1 scan
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}>
            <MessageSquare className="w-3 h-3" />
            {Math.max(0, 5 - chatsUsed)}/5 chats
          </span>
          {user.dob && (
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{calculateAge(user.dob)}y</span>
          )}
        </div>

        <Section title="Personal Details">
          <Field label="Name">
            <input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} className={fieldClass} style={fieldStyle} />
          </Field>
          <Field label="Gender">
            <select value={form.gender} onChange={(e) => set({ gender: e.target.value })} className={fieldClass} style={fieldStyle}>
              <option value="">Select…</option>
              {GENDERS.map((g) => <option key={g.val} value={g.val}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" value={form.dob} onChange={(e) => set({ dob: e.target.value })} className={fieldClass} style={fieldStyle} />
          </Field>
          <Field label="City">
            <CityInput value={form.city} onChange={(v) => set({ city: v })} />
          </Field>
        </Section>

        <Section title="Body Metrics">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Height (cm)">
              <input type="number" value={form.height} onChange={(e) => set({ height: e.target.value })} className={fieldClass} style={fieldStyle} />
            </Field>
            <Field label="Weight (kg)">
              <input type="number" value={form.weight} onChange={(e) => set({ weight: e.target.value })} className={fieldClass} style={fieldStyle} />
            </Field>
            <Field label="Waist (in)">
              <input type="number" value={form.waist} onChange={(e) => set({ waist: e.target.value })} className={fieldClass} style={fieldStyle} />
            </Field>
          </div>
        </Section>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-shadow duration-150 disabled:opacity-50 mb-8"
          style={{ background: 'var(--teal)' }}
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Unlock more of your report — real price, real deep link, no payment
            gateway exists yet so this hands off to the same local-unlock toggle
            already on the Questionnaire hub rather than pretending to charge here. */}
        <Section title="Unlock more of your report">
          <div className="rounded-2xl border overflow-hidden divide-y" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <button
              type="button"
              onClick={() => router.push('/add-prospect?enter=radiology')}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.02]"
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--soft-amber)' }}>
                <ScanLine className="w-4 h-4" style={{ color: 'var(--amber-d)' }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Radiology Reports</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>₹999 one-time unlock</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
            </button>
            <div className="flex items-center gap-3 px-4 py-3.5 opacity-60">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--paper)' }}>
                <Dna className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Genomics Report</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Coming soon</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Settings — no real compliance/preferences screen exists yet, so this
            stays a single honestly-labeled "coming soon" row rather than a
            settings page with nothing behind it. This used to be a separate
            gear icon in the dashboard header (duplicating the avatar's own
            link to this page) — consolidated here instead. */}
        <Section title="Settings">
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 px-4 py-3.5 opacity-60">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--paper)' }}>
                <Settings className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Compliance</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>DPDP compliance coming soon</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Account actions — logout, then account deletion, deliberately last */}
        <div className="rounded-2xl border overflow-hidden divide-y" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <button
            type="button"
            onClick={() => router.push('/admin/whatsapp')}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.02]"
            style={{ color: 'var(--ink)' }}
          >
            <MessageCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
            <span className="text-sm font-semibold">WhatsApp Messages (Admin)</span>
          </button>
          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.02]"
            style={{ color: 'var(--danger-d)' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">Log Out</span>
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.02] disabled:opacity-60"
            style={{ color: 'var(--danger-d)' }}
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">{isDeleting ? 'Deleting…' : 'Delete Account & Data'}</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-8 opacity-40">
          <Sparkles className="w-3 h-3" />
          <span className="text-[10px] font-medium">SlayHealth</span>
        </div>
      </div>
    </main>
  );
}
