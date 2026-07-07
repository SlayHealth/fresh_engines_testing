'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { HEALTH_TOPICS } from '../../constants/landingContent';
import { QuickTrustBadges } from './TrustSignals';

const BENTO_IMAGES = [
  { src: '/images/hs-1.png', alt: 'Couple health consultation', span: 'lg:col-span-2 lg:row-span-2', delay: 100 },
  { src: '/images/hs-2.png', alt: 'Health screening services', span: 'lg:col-span-2 lg:row-span-1', delay: 200 },
  { src: '/images/hs-4.png', alt: 'Medical professional consultation', span: '', delay: 300 },
  { src: '/images/hero-image4.png', alt: 'Health checkup services', span: 'lg:row-span-2', delay: 400 },
  { src: '/images/hs-3.png', alt: 'Wellness consultation', span: 'lg:col-span-2 lg:row-span-1', delay: 500 },
  { src: '/images/hs-5.png', alt: 'Preventive healthcare', span: 'lg:col-span-1 lg:row-span-1', delay: 600 },
  { src: '/images/hs-6.png', alt: 'Healthcare professionals', span: 'lg:col-span-2 lg:row-span-1', delay: 700 },
  { src: '/images/hs-7.png', alt: 'Health assessments', span: 'lg:col-span-2 lg:row-span-1', delay: 800 }
];

const MOBILE_BG_IMAGES = [
  { src: '/images/hs-1.png', className: 'col-span-2 row-span-2' },
  { src: '/images/hs-2.png', className: 'col-span-1 row-span-2' },
  { src: '/images/hs-4.png', className: 'col-span-1 row-span-1' },
  { src: '/images/hero-image4.png', className: 'col-span-2 row-span-1' }
];

export default function HeroSection({ continueHref }) {
  const [topicIndex, setTopicIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTopicIndex((prev) => (prev + 1) % HEALTH_TOPICS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const rotatingWord = (
    <span className="inline-block px-2 rounded-md" style={{ background: 'var(--soft-pink)', color: 'var(--pink-d)' }}>
      <span key={topicIndex} className="inline-block animate-fade-in">{HEALTH_TOPICS[topicIndex]}</span>
    </span>
  );

  return (
    <section className="relative overflow-hidden">
      {/* Mobile-only dimmed photo backdrop */}
      <div className="absolute inset-0 lg:hidden">
        <div className="grid grid-cols-3 grid-rows-3 gap-1 w-full h-full">
          {MOBILE_BG_IMAGES.map((img) => (
            <div key={img.src} className={`${img.className} relative overflow-hidden`}>
              <Image src={img.src} alt="" fill sizes="70vw" className="object-cover" priority />
            </div>
          ))}
        </div>
        <div className="absolute inset-0" style={{ background: 'rgba(20,22,26,0.55)' }} />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10 py-10 lg:py-20 max-w-7xl">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-16 items-center">
          {/* Bento grid — desktop only */}
          <div className="relative hidden lg:block lg:order-1 w-full">
            <div className="grid lg:grid-cols-4 lg:grid-rows-4 gap-2 w-full h-[520px]">
              {BENTO_IMAGES.map((img, i) => (
                <div
                  key={img.src + i}
                  className={`${img.span} relative rounded-xl overflow-hidden shadow transition-transform duration-500 hover:scale-105 opacity-0 animate-fade-in-up`}
                  style={{ animationDelay: `${img.delay}ms`, animationFillMode: 'forwards' }}
                >
                  <Image src={img.src} alt={img.alt} fill sizes="25vw" className="object-cover" priority={i < 2} />
                </div>
              ))}
            </div>
          </div>

          {/* Hero copy — white card on mobile so it reads over the photo backdrop, plain (no box) on desktop */}
          <div className="lg:order-2 text-left animate-fade-in-up rounded-3xl p-6 sm:p-8 lg:p-0 lg:rounded-none bg-(--surface) lg:bg-transparent">
            <h3 className="flex items-center gap-2 mb-5 lg:mb-6 text-base md:text-lg" style={{ color: 'var(--muted)' }}>
              <Sparkles className="w-5 h-5" style={{ color: 'var(--teal)' }} />
              Your Future Is <span className="underline">Everything!</span>
            </h3>

            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-serif tracking-tight mb-6 lg:mb-8 leading-tight" style={{ color: 'var(--ink)' }}>
              For those who believe
              <br />
              {rotatingWord}
              <br />
              that matter for your life together
            </h1>

            <p className="mb-8 lg:mb-10 text-lg md:text-xl max-w-lg" style={{ color: 'var(--muted)' }}>
              Say <strong style={{ color: 'var(--ink)' }}>&ldquo;YES&rdquo;</strong>{' '}with clarity &amp; confidence — not with fingers crossed.
            </p>

            <div className="flex flex-col items-start gap-6">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Link
                  href={continueHref || '/login'}
                  className="text-white px-8 py-4 rounded-lg font-semibold text-base lg:text-lg shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                  style={{ background: 'var(--pink)' }}
                >
                  {continueHref ? 'Continue' : 'Get Started'}
                  {continueHref && <ArrowRight className="w-5 h-5" />}
                </Link>
                <a
                  href="#stories"
                  className="border px-8 py-4 rounded-lg font-semibold text-base lg:text-lg shadow-sm transition-all flex items-center justify-center gap-2 group"
                  style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' }}
                >
                  See The Real Numbers
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>

              <QuickTrustBadges />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
