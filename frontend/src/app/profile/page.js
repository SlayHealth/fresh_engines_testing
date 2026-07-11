'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Sparkles, Activity, MessageSquare, MessageCircle } from 'lucide-react';
import { useCompatibility, calculateAge } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ConfirmDialog';
import CityInput from '../../components/wizard/CityInput';
import { GENDERS } from '../../constants/lifestyleOptions';

const fieldClass = 'w-full p-3 border rounded-xl outline-none text-sm';
const fieldStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

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

  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    if (user && !form) {
      setForm({
        name: user.name || '',
        gender: user.gender || '',
        dob: user.dob || '',
        city: user.city || '',
        height: user.height || '',
        weight: user.weight || '',
        waist: user.waist || ''
      });
    }
  }, [user, form]);

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

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
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

        {/* Account actions — logout is deliberately the last item here */}
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
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-8 opacity-40">
          <Sparkles className="w-3 h-3" />
          <span className="text-[10px] font-medium">SlayHealth</span>
        </div>
      </div>
    </main>
  );
}
