'use client';

import Ico from '../../components/mobile/Ico';
import WeightedGauge from '../../components/mobile/WeightedGauge';
import MobileSectionList from '../../components/mobile/MobileSectionList';
import MobileMiniRing from '../../components/mobile/MobileMiniRing';
import NotificationBell from '../../components/NotificationBell';
import { toMobileSections, weightedSections } from '../../utils/mobileSections';
import { toast } from '../../components/Toast';

// Mobile Home — a faithful reproduction of contexts/ui_mobile_update.html's
// Home view, rendered entirely from real data: the weighted gauge, confidence
// number, "N of 5 sections", next-best-action, recent match and the section
// list all derive from the real health-profile categories and matches list.
export default function MobileHomeView({
  user,
  healthProfileCategories,
  matchesList,
  isMatchesLoading,
  scansLeft,
  chatsLeft,
  restoreMatchSession,
  router,
  hasResumableProspectDraft,
  prospectDraftName,
  prospectDraftConfidence
}) {
  const sections = toMobileSections(healthProfileCategories);
  const weighted = weightedSections(sections);
  // Confidence computed the mockup's way so the gauge arcs and the centre number
  // can never disagree: Σ(weight × pct) / 100.
  const conf = Math.round(weighted.reduce((a, s) => a + (s.weight * s.pct) / 100, 0));
  const done = weighted.filter((s) => s.pct > 0).length;
  const recentMatch = matchesList?.[0];

  const firstName = (user.name || 'there').trim().split(/\s+/)[0];
  const initial = user.name ? user.name[0].toUpperCase() : 'U';
  const now = new Date();
  const h = now.getHours();
  const timeOfDay = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  const greeting = `Good ${timeOfDay}`;

  // next best action = heaviest untouched, unlocked section
  const next = weighted.filter((s) => s.pct === 0 && s.state !== 'locked').sort((a, b) => b.weight - a.weight)[0];
  const heaviest = [...weighted].sort((a, b) => b.weight - a.weight)[0];
  const leverName = heaviest ? (heaviest.id === 'pathology' ? 'Bloodwork' : heaviest.title) : 'Bloodwork';

  const openSection = (s) => router.push(`/add-prospect?enter=${s.id}`);
  const askAI = () => {
    if (recentMatch) { restoreMatchSession(recentMatch); router.push('/core-engine/story'); }
    else router.push('/add-prospect');
  };

  const scanMeter = Array.from({ length: 1 }, (_, i) => <i key={i} className={i < scansLeft ? 'f' : ''} />);
  const chatMeter = Array.from({ length: 5 }, (_, i) => <i key={i} className={i < chatsLeft ? 'f' : ''} />);

  return (
    <div className="mshell" data-mtheme="light">
      <header className="appbar">
        <button
          type="button"
          onClick={() => router.push('/profile')}
          style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, textAlign: 'left' }}
          aria-label="Open profile"
        >
          <div className="av">{initial}</div>
          <div className="ab-txt">
            <div className="ab-hi">{greeting}</div>
            <div className="ab-name serif">{firstName}</div>
          </div>
        </button>
        <div className="ab-actions">
          <NotificationBell userId={user.id} />
        </div>
      </header>

      <main className="scroll">
        <div className="chips rise" style={{ animationDelay: '.02s' }}>
          <span className="chip"><span className="meter">{scanMeter}</span> {scansLeft} scan{scansLeft === 1 ? '' : 's'} left</span>
          <span className="chip"><span className="meter m">{chatMeter}</span> {chatsLeft} chat{chatsLeft === 1 ? '' : 's'} left</span>
          <button className="chip edit" onClick={() => router.push('/add-prospect?enter=about')}>
            <b>{user.city || 'Edit profile'}</b>
            <Ico name="pencil" sm />
          </button>
        </div>

        {/* signature: weighted confidence gauge */}
        <section className="hero grain rise" style={{ animationDelay: '.06s' }}>
          <div className="hero-top">
            <span className="eyebrow">The Full Picture</span>
            <span className="thr"><Ico name="shield" sm /> Reliable at 70%</span>
          </div>
          <WeightedGauge sections={weighted} confidence={conf} subLabel={`${done} of ${weighted.length} sections`} />
          <p className="hero-line">Each arc is one section, sized by how much it moves the score. <b>{leverName} is your biggest lever.</b></p>
          {next && (
            <button className="next" onClick={() => openSection(next)}>
              <span className="nx-i"><Ico name={next.icon} /></span>
              <span className="nx-t">
                <b>Continue — {next.title.toLowerCase()}</b>
                <small>{next.duration ? `≈${next.duration} · ` : ''}+{next.weight}% confidence</small>
              </span>
              <span className="nx-a"><Ico name="arrow" /></span>
            </button>
          )}
        </section>

        {/* Resume banner — a named prospect with no completed match yet is an
            active, unfinished draft. Clicking through lands back on the exact
            step/category add-prospect/page.js's own wizard-position draft
            resumes to. */}
        {hasResumableProspectDraft && (
          <button className="recent card" onClick={() => router.push('/add-prospect')} style={{ marginBottom: 14 }}>
            <div className="nx-i" style={{ background: 'var(--t-teal)', color: 'var(--h-teal)' }}>
              <Ico name="clock" />
            </div>
            <span className="r-t">
              <b className="serif">Continue Your Last Draft</b>
              <span className="r-m">Partner: {prospectDraftName} · {prospectDraftConfidence}% Complete</span>
            </span>
            <Ico name="chev" className="chevron" />
          </button>
        )}

        {/* brand band: the money action */}
        <section className="match grain rise" style={{ animationDelay: '.12s' }}>
          <div className="m-t">
            <span className="eyebrow">Free plan · {scansLeft} match{scansLeft === 1 ? '' : 'es'} left</span>
            <h3 className="serif">Start a compatibility check</h3>
            <p>Invite your partner — we compare both profiles, not just yours.</p>
          </div>
          <button className="m-go" onClick={() => router.push('/add-prospect')} aria-label="Start a compatibility check">
            <Ico name="plus" />
          </button>
        </section>

        <div className="shead"><h2 className="serif">Recent</h2></div>
        {isMatchesLoading ? (
          <div className="recent card" style={{ justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12.5 }}>Loading…</div>
        ) : recentMatch ? (
          <button className="recent card" onClick={() => { restoreMatchSession(recentMatch); router.push('/core-engine/story'); }}>
            <MobileMiniRing pct={recentMatch.score || 0} tone="moss" />
            <span className="r-t">
              <b className="serif">{recentMatch.user?.name || user.name} &amp; {recentMatch.prospect?.name || 'Partner'}</b>
              <span className="r-m">
                <Ico name="heart" sm />
                {recentMatch.prospect?.meetingSource || 'Compatibility check'}
                <i className="sep" />
                {new Date(recentMatch.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </span>
            <Ico name="chev" className="chevron" />
          </button>
        ) : (
          <button className="recent card" onClick={() => router.push('/add-prospect')} style={{ justifyContent: 'space-between' }}>
            <span className="r-t">
              <b className="serif">No compatibility checks yet</b>
              <span className="r-m">Start your first check</span>
            </span>
            <Ico name="chev" className="chevron" />
          </button>
        )}

        <div className="shead">
          <h2 className="serif">Your health profile</h2>
          <span>{done} of {weighted.length} done</span>
        </div>
        <p className="ssub">Every card saves as you go. Leave, come back, finish on a lunch break.</p>
        <MobileSectionList
          sections={sections}
          onOpen={openSection}
          onUnlock={() => router.push('/add-prospect?enter=radiology')}
        />

        {/* care card — reworded to describe the real AI assistant, no clinician claim */}
        <section className="care grain">
          <div className="stack">
            <span style={{ background: '#F1D7E2' }} />
            <span style={{ background: '#D4EBE4' }} />
            <span style={{ background: '#E6E0F2' }} />
          </div>
          <h3 className="serif">Understand it, don&apos;t just read it</h3>
          <p>Our AI assistant explains every number in plain language — ask it anything you&apos;d rather not Google. Human consults are coming soon.</p>
          <div className="acts">
            <button className="b-light" onClick={askAI}>Ask the AI assistant</button>
            <button className="b-outline" onClick={() => toast.info('Doctor consults are coming soon.')}>Book a call</button>
          </div>
        </section>

        <p className="trust"><Ico name="lock" /> Encrypted end to end. Nothing is shared with your partner or family until you say so.</p>
        <p className="text-[10px] text-center leading-relaxed px-4" style={{ color: 'var(--ink-3)' }}>
          This report is for informational and educational purposes and does not diagnose or treat any medical condition. Always confirm results with a qualified doctor.
        </p>
      </main>
    </div>
  );
}
