'use client';

import { Sparkles } from 'lucide-react';
import styles from '../../page.module.css';

export default function GenomicsPage() {
  return (
    <div className={styles.comingSoonBox}>
      <div className={styles.comingSoonIconBg} style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(217, 67, 134, 0.1)', color: '#d94386', marginBottom: '1.5rem' }}>
        <Sparkles size={32} />
      </div>
      <h3 className={styles.comingSoonTitleText} style={{ fontSize: '18px', fontWeight: '700', color: '#2b2b3f', marginBottom: '8px' }}>Genetics & Infection Carrier Risk</h3>
      <p className={styles.comingSoonSubtext} style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
        Extracts karyotyping genetic anomalies and checks carrier risk for beta thalassemia or structural deletions.
        <br /><br />
        <strong style={{ color: '#d94386' }}>Currently Coming Soon under Premium plans.</strong>
      </p>
    </div>
  );
}
