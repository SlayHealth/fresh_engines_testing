'use client';

import Link from 'next/link';
import { Activity, ShieldCheck, HeartPulse, Sparkles, Database } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
      <header className={styles.header} style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 className={styles.title} style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem'
        }}>
          SlayHealth Engines Portal
        </h1>
        <p className={styles.subtitle} style={{ color: '#9ca3af', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto', marginBottom: '2.5rem' }}>
          Select a clinical analysis engine to evaluate, project, and optimize premarital health compatibility profiles.
        </p>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '4rem', flexWrap: 'wrap' }}>
          <Link href="/" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--primary)' }}>
            Home Portal
          </Link>
          <Link href="/usg" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--glass-border)' }}>
            USG Abdomen
          </Link>
          <Link href="/chronic" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--glass-border)' }}>
            Chronic Health
          </Link>
          <Link href="/mfr" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--glass-border)' }}>
            Fertility Analysis
          </Link>
          <Link href="/db" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--glass-border)' }}>
            DB Inspector
          </Link>
        </div>
      </header>

      {/* Grid of Portal Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem',
        marginBottom: '4rem'
      }}>
        {/* USG Card */}
        <div className="glass-panel" style={{
          padding: '2.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          transition: 'transform 0.3s ease, border-color 0.3s ease'
        }}>
          <div>
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '12px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--teal)', marginBottom: '1.5rem' }}>
              <ShieldCheck size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#fff' }}>USG Abdomen Engine</h2>
            <p style={{ color: '#9ca3af', lineHeight: '1.6', marginBottom: '2rem' }}>
              Extract and analyze abdominal ultrasound files (PDF/images) to evaluate organ-specific wellness score grids (liver, kidneys, bladder, reproductive organs) and generate couple risk matrices.
            </p>
          </div>
          <Link href="/usg" style={{
            display: 'block',
            textAlign: 'center',
            padding: '0.8rem 1.5rem',
            background: 'var(--teal)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 'bold',
            borderRadius: '8px',
            transition: 'opacity 0.2s'
          }}>
            Launch USG Engine
          </Link>
        </div>

        {/* Chronic Card */}
        <div className="glass-panel" style={{
          padding: '2.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          transition: 'transform 0.3s ease, border-color 0.3s ease'
        }}>
          <div>
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', marginBottom: '1.5rem' }}>
              <Activity size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#fff' }}>Chronic Health Engine</h2>
            <p style={{ color: '#9ca3af', lineHeight: '1.6', marginBottom: '2rem' }}>
              Analyze clinical biomarker payloads (HbA1c, lipids, BP) combined with lifestyle data to model 10-year condition-free probability trajectories and calculate joint lifestyle health dividends.
            </p>
          </div>
          <Link href="/chronic" style={{
            display: 'block',
            textAlign: 'center',
            padding: '0.8rem 1.5rem',
            background: 'var(--primary)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 'bold',
            borderRadius: '8px',
            transition: 'opacity 0.2s'
          }}>
            Launch Chronic Engine
          </Link>
        </div>

        {/* Fertility Card */}
        <div className="glass-panel" style={{
          padding: '2.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          transition: 'transform 0.3s ease, border-color 0.3s ease'
        }}>
          <div>
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', marginBottom: '1.5rem' }}>
              <HeartPulse size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#fff' }}>Fertility & Timeline (MFR)</h2>
            <p style={{ color: '#9ca3af', lineHeight: '1.6', marginBottom: '2rem' }}>
              Assess natural conception timelines and age-related probability curves by combining WHO 2021 semen quality limits with ovarian reserve biomarkers (AMH, AFC) and lifestyle factors.
            </p>
          </div>
          <Link href="/mfr" style={{
            display: 'block',
            textAlign: 'center',
            padding: '0.8rem 1.5rem',
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 'bold',
            borderRadius: '8px',
            transition: 'opacity 0.2s'
          }}>
            Launch Fertility Engine
          </Link>
        </div>
      </div>

      {/* Footer / Utilities */}
      <footer style={{ display: 'flex', justifyContent: 'center', gap: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem', marginTop: '2rem' }}>
        <Link href="/db" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#9ca3af', textDecoration: 'none', fontSize: '0.95rem' }}>
          <Database size={18} />
          Database Inspector
        </Link>
        <span style={{ color: 'var(--glass-border)' }}>|</span>
        <span style={{ color: '#6b7280', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} /> Powered by SlayHealth Math Engine
        </span>
      </footer>
    </main>
  );
}
