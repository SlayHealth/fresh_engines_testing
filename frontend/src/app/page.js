'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Lock, Heart, Brain, Coins, Users, Activity, Dna, Baby, Sparkles } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import Reveal from '../components/landing/Reveal';
import StoryTabs from '../components/landing/StoryTabs';
import PersonaSection from '../components/landing/PersonaSection';
import TestimonialCard from '../components/landing/TestimonialCard';
import PricingCard from '../components/landing/PricingCard';
import { TrustSignals } from '../components/landing/TrustSignals';
import { STORIES, TESTIMONIALS, PRICING_PLANS, PERSONAS, ANALYSIS_AREAS } from '../constants/landingContent';

const AREA_ICONS = { Dna, Baby, Heart, Activity, Brain, Users };

export default function LandingPage() {
  // Returning logged-in visitors still see the landing page — just with a
  // "Continue" shortcut back into the app instead of "Login"/"Get Started".
  const [continueHref, setContinueHref] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) return;
    try {
      const parsed = JSON.parse(savedUser);
      setContinueHref(parsed.name ? '/dashboard' : '/onboarding');
    } catch (e) {
      localStorage.removeItem('slayhealth_user');
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <LandingHeader continueHref={continueHref} />
      <HeroSection continueHref={continueHref} />

      {/* STORIES */}
      <section id="stories" className="py-16 lg:py-20" style={{ background: 'linear-gradient(180deg, var(--soft-teal) 0%, var(--surface) 40%, var(--soft-pink) 100%)' }}>
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <Reveal as="div" className="text-center mb-12 lg:mb-16">
            <h3 className="flex items-center justify-center gap-3 mb-4" style={{ color: 'var(--muted)' }}>
              <Sparkles className="w-5 h-5" />
              <span className="text-lg lg:text-xl">Before you say <span className="underline">&ldquo;I Do!&rdquo;</span></span>
              <Sparkles className="w-5 h-5" />
            </h3>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-tight mb-5" style={{ color: 'var(--ink)' }}>
              The Real Numbers: Know Before Your Wedding
            </h1>
            <p className="mx-auto max-w-2xl text-base lg:text-lg" style={{ color: 'var(--muted)' }}>
              These are not statistics — these are stories that happen every day to couples who thought{' '}
              <strong style={{ color: 'var(--pink-d)' }}>&ldquo;it won&rsquo;t happen to us.&rdquo;</strong>
            </p>
          </Reveal>

          <StoryTabs stories={STORIES} />
        </div>
      </section>

      {/* CTA STRIP */}
      <Reveal as="section" className="py-12 lg:py-16" style={{ background: 'var(--ink)' }}>
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 text-center lg:text-left">
              <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl leading-tight mb-3 text-white">
                You can&apos;t change the statistics.
              </h2>
              <p className="text-xl md:text-2xl mb-4" style={{ color: 'var(--teal)' }}>
                But you can choose not to become one.
              </p>
              <p className="text-sm lg:text-base leading-relaxed max-w-lg lg:mx-0 mx-auto text-slate-400">
                A 15-minute conversation. A simple health check. That&apos;s all it takes to start your marriage with clarity, not uncertainty.
              </p>
            </div>
            <div className="rounded-2xl p-8 lg:p-10 text-center min-w-[280px]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-xs uppercase tracking-wider font-bold mb-2 text-slate-400">Starting at</p>
              <p className="text-4xl lg:text-5xl font-bold text-white mb-5">₹799</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-white px-6 py-3.5 rounded-full font-bold text-sm lg:text-base transition-all hover:scale-105 shadow-lg w-full justify-center"
                style={{ background: 'var(--teal)' }}
              >
                Talk to an Advisor <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex flex-col gap-2 mt-5 text-sm text-slate-400">
                <span className="flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> 100% Private</span>
                <span className="flex items-center justify-center gap-2"><Activity className="w-4 h-4" /> Doctor Reviewed</span>
                <span className="flex items-center justify-center gap-2"><Users className="w-4 h-4" /> For Both Partners</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* PERSONAS */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <Reveal as="div" className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl mb-4" style={{ color: 'var(--ink)' }}>
              Start where your situation begins.
            </h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: 'var(--muted)' }}>
              Every marriage story is different. The health checks you need shouldn&apos;t be guessed.
            </p>
          </Reveal>

          <PersonaSection personas={PERSONAS} />
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 lg:py-20 overflow-hidden" style={{ background: 'var(--ink)' }}>
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <Reveal as="div" className="text-center mb-12 lg:mb-16">
            <h2 className="font-serif text-3xl md:text-4xl mb-4 text-white">Real People, Real Clarity</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.id} delay={i * 120}>
                <TestimonialCard {...t} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* POSITIONING */}
      <Reveal as="section" className="py-16 lg:py-20 text-center" style={{ background: 'var(--gradient-primary)' }}>
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight text-white">
            The world&apos;s first AI-powered premarital health compatibility engine for every couple.
          </h2>
          <div className="text-lg md:text-xl space-y-2 text-white/90">
            <p>What marriage counselors wish existed.</p>
            <p>What doctors recommend doing.</p>
            <p>What smart couples actually use.</p>
          </div>
        </div>
      </Reveal>

      {/* ANALYSIS AREAS */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <Reveal as="div" className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--ink)' }}>
              6 Critical Areas Most Couples Never Discuss
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {ANALYSIS_AREAS.map((card, i) => {
              const Icon = AREA_ICONS[card.icon] || Users;
              return (
                <Reveal key={card.title} delay={(i % 3) * 100}>
                  <div
                    className="p-7 lg:p-8 rounded-xl border transition-all group cursor-default h-full"
                    style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div className="p-3.5 rounded-lg transition-colors" style={{ background: 'var(--paper)' }}>
                        <Icon className="w-6 h-6 lg:w-7 lg:h-7" style={{ color: 'var(--teal-d)' }} />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1.5 rounded" style={{ background: 'var(--paper)', color: 'var(--muted)' }}>
                        {card.score} of score
                      </span>
                    </div>
                    <h3 className="text-lg lg:text-xl font-bold mb-2.5" style={{ color: 'var(--ink)' }}>{card.title}</h3>
                    <p className="text-sm lg:text-base mb-4" style={{ color: 'var(--muted)' }}>{card.desc}</p>
                    <p className="text-sm lg:text-base leading-relaxed border-t pt-4" style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}>{card.detail}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <Reveal as="div" className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--ink)' }}>
              Choose What You Need to Know
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {PRICING_PLANS.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 120}>
                <PricingCard plan={plan} />
              </Reveal>
            ))}
          </div>

          <Reveal as="div" className="max-w-4xl mx-auto">
            <h3 className="text-center text-2xl font-bold mb-8" style={{ color: 'var(--ink)' }}>
              Why Couples Trust SlayHealth
            </h3>
            <TrustSignals variant="detailed" />
          </Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 lg:py-20" style={{ background: 'var(--ink)' }}>
        <div className="container mx-auto px-4 sm:px-6 text-center max-w-4xl">
          <Reveal as="h2" className="text-3xl md:text-4xl font-bold mb-8 text-white">
            Every Day of Delay Is One More Day of Uncertainty
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-4xl mx-auto mb-12">
            {[
              { icon: Clock, color: 'var(--amber)', stat: '2 Years', desc: 'Average time wasted trying to conceive before discovering issues' },
              { icon: Coins, color: 'var(--teal)', stat: '₹2.5 Lakhs', desc: 'Cost of IVF vs ₹15k for early supplements' },
              { icon: Heart, color: 'var(--pink)', stat: 'Regret', desc: 'The emotional cost of not knowing earlier' }
            ].map((item, i) => (
              <Reveal key={item.stat} delay={i * 100}>
                <div className="p-7 lg:p-8 rounded-xl h-full" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <item.icon className="w-8 h-8 mx-auto mb-4" style={{ color: item.color }} />
                  <div className="text-2xl lg:text-3xl font-bold mb-2.5 text-white">{item.stat}</div>
                  <p className="text-slate-400 text-sm lg:text-base leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Link
            href="/login"
            className="inline-block text-white px-10 py-5 rounded-lg font-bold text-xl shadow-lg transition-all hover:scale-105 mb-6"
            style={{ background: 'var(--pink)' }}
          >
            Get Your Clarity Now — Takes 5 Minutes
          </Link>
          <p className="mt-4 mb-6 text-slate-400 text-sm">
            Free health assessment to start • No credit card required • Begin privately
          </p>

          <TrustSignals variant="compact" className="mt-6" />
        </div>
      </section>

      <footer className="py-8 text-center text-xs" style={{ background: 'var(--ink)', color: 'var(--muted)' }}>
        © {new Date().getFullYear()} SlayHealth. All rights reserved.
      </footer>
    </div>
  );
}
