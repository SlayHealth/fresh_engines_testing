'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Search, ArrowDownLeft, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { API_URL } from '../../../config/api';
import { apiFetch } from '../../../utils/api';

const STATUS_COLORS = {
  sent: { bg: 'var(--soft-blue)', color: 'var(--info)' },
  delivered: { bg: 'var(--soft-teal)', color: 'var(--teal-d)' },
  read: { bg: 'var(--soft-teal)', color: 'var(--teal-d)' },
  received: { bg: 'var(--soft-teal)', color: 'var(--teal-d)' },
  failed: { bg: 'var(--soft-danger)', color: 'var(--danger-d)' }
};

function StatusPill({ status }) {
  const style = STATUS_COLORS[status] || { bg: 'var(--line)', color: 'var(--muted)' };
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
      style={{ background: style.bg, color: style.color }}
    >
      {status || 'unknown'}
    </span>
  );
}

export default function AdminWhatsAppPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState('');

  const fetchMessages = useCallback(async (phone) => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = phone ? `?phone=${encodeURIComponent(phone)}` : '';
      const res = await apiFetch(`${API_URL}/api/admin/whatsapp/messages${qs}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load messages');
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
      return;
    }
    fetchMessages();
  }, [router, fetchMessages]);

  // Light auto-refresh so the board feels live without a websocket
  useEffect(() => {
    const interval = setInterval(() => fetchMessages(phoneFilter), 10000);
    return () => clearInterval(interval);
  }, [fetchMessages, phoneFilter]);

  if (forbidden) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="text-center max-w-sm px-6">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--danger)' }} />
          <h1 className="font-serif text-lg font-semibold mb-2" style={{ color: 'var(--ink)' }}>Admin access required</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>This account isn't on the admin allowlist for the WhatsApp message board.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm font-semibold px-4 py-2 rounded-full"
            style={{ background: 'var(--teal)', color: '#fff' }}
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 hover:bg-black/5"
            style={{ color: 'var(--muted)' }}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>WhatsApp Messages</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>All messages sent and received via the business number, logged since this board shipped.</p>
          </div>
          <button
            onClick={() => fetchMessages(phoneFilter)}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 hover:bg-black/5"
            style={{ color: 'var(--muted)' }}
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Filter by phone number…"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchMessages(phoneFilter); }}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none text-sm"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' }}
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs font-medium mb-4" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>
            {error}
          </div>
        )}

        {!isLoading && messages.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No messages logged yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>This board only captures messages sent or received after it shipped — WhatsApp doesn't expose a history API.</p>
          </div>
        )}

        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-2xl border p-3.5 flex items-start gap-3"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: msg.direction === 'inbound' ? 'var(--soft-teal)' : 'var(--soft-pink)' }}
              >
                {msg.direction === 'inbound'
                  ? <ArrowDownLeft className="w-4 h-4" style={{ color: 'var(--teal-d)' }} />
                  : <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--pink-d)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{msg.phone_number}</span>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs leading-relaxed break-words" style={{ color: 'var(--ink)' }}>
                  {msg.body_text || (msg.template_name ? `Template: ${msg.template_name}` : `[${msg.message_type || 'message'}]`)}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={msg.status} />
                  {msg.message_type && (
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{msg.message_type}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
