'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Heart, Sparkles, FileBarChart2, UserRound, ChevronLeft, ChevronRight } from 'lucide-react';

// Persistent desktop app shell: a collapsible left sidebar (brand + nav + account
// footer) and a fluid content area. Rendered only on the desktop tree (>=1024px,
// see useIsMobile); mobile keeps its bottom nav. Uses the shared brand tokens,
// re-scoped to a warm cinematic palette, so it reads as the same product as the
// mobile UI it echoes.
//
// Props:
//   user      — the logged-in user (for the account footer)
//   children  — the page content for the main column
const NAV = [
  { key: 'home', label: 'Home', icon: Home, href: '/dashboard', match: (p) => p === '/dashboard' },
  { key: 'matches', label: 'Matches', icon: Heart, href: '/add-prospect', match: (p) => p.startsWith('/add-prospect') },
  { key: 'insights', label: 'Insights', icon: Sparkles, href: '/core-engine/story', match: (p) => p.startsWith('/core-engine') },
  { key: 'reports', label: 'Reports', icon: FileBarChart2, href: '/core-engine/story', match: () => false },
  { key: 'profile', label: 'Profile', icon: UserRound, href: '/profile', match: (p) => p === '/profile' },
];

const STORE_KEY = 'slay_sidebar_collapsed';

export default function DesktopShell({ user, children }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);

  // Restore the collapsed preference (the shell re-mounts per page, so persist it).
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(STORE_KEY) === '1') setCollapsed(true);
  }, []);
  const toggle = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem(STORE_KEY, next ? '1' : '0'); } catch {}
    return next;
  });

  const initial = user?.name ? user.name[0].toUpperCase() : 'U';
  const firstName = (user?.name || 'there').trim().split(/\s+/)[0];

  return (
    <div
      className="min-h-screen flex"
      style={{
        // Warm-white, cinematic tone — scoped to the desktop shell only (these
        // CSS-var overrides cascade to all children, so cards/borders/muted text
        // warm up with zero edits elsewhere; nothing outside the shell changes).
        '--paper': '#F7F4EF',      // light warm off-white ground
        '--surface': '#FFFEFC',    // near-white cards, faint warmth
        '--line': '#ECE7DE',       // soft warm hairline borders
        '--muted': '#6B6459',      // warm grey text
        background: 'radial-gradient(150% 100% at 50% -8%, #FCFAF6 0%, #F7F3EC 60%, #F3EFE7 100%)',
        color: 'var(--ink)'
      }}
    >
      <style>{`.slay-desk .rounded-2xl{box-shadow:0 1px 2px rgba(80,64,40,.045),0 18px 40px -26px rgba(80,64,40,.18);}`}</style>

      {/* Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen border-r relative transition-[width] duration-200 ${collapsed ? 'w-[76px]' : 'w-[248px]'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        {/* Edge collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-150"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--teal-d)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand */}
        <button
          onClick={() => router.push('/dashboard')}
          className={`flex items-center h-[68px] shrink-0 ${collapsed ? 'justify-center px-0' : 'gap-2 px-6'}`}
        >
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--teal)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          {!collapsed && (
            <span className="font-serif text-lg font-semibold leading-none" style={{ color: 'var(--ink)' }}>
              slay<span style={{ color: 'var(--teal-d)' }}>health</span>
            </span>
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <button
                key={item.key}
                onClick={() => router.push(item.href)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-colors duration-150 ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'}`}
                style={active
                  ? { background: 'var(--soft-teal)', color: 'var(--teal-d)', fontWeight: 600 }
                  : { color: 'var(--muted)' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.035)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* Account footer */}
        <button
          onClick={() => router.push('/profile')}
          title={collapsed ? firstName : undefined}
          className={`flex items-center m-3 rounded-xl border text-left transition-colors duration-150 ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-4 py-3.5'}`}
          style={{ borderColor: 'var(--line)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif font-semibold text-sm shrink-0" style={{ background: 'var(--pink)' }}>
            {initial}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>{firstName}</span>
              <span className="block text-[11px] leading-tight truncate" style={{ color: 'var(--muted)' }}>View profile</span>
            </span>
          )}
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 relative">
        {/* Ambient art — warm, cinematic: a soft key light from the top, gentle
            brand glows, a faint warm grain, and a vignette that frames the page. */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(rgba(120,90,50,0.045) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          {/* soft warm key light */}
          <div className="absolute -top-56 left-1/2 -translate-x-1/2 w-[1100px] h-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(246,208,165,0.13), transparent 70%)' }} />
          {/* soft brand glows, warmed */}
          <div className="absolute top-8 right-[8%] w-[520px] h-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(222,69,125,0.09), transparent 70%)' }} />
          <div className="absolute bottom-[-180px] left-[6%] w-[620px] h-[620px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(24,163,143,0.09), transparent 70%)' }} />
          {/* cinematic warm vignette */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 130% at 50% 26%, transparent 55%, rgba(80,64,40,0.06) 100%)' }} />
        </div>
        <div className="slay-desk relative max-w-[1160px] mx-auto px-8 xl:px-12 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
