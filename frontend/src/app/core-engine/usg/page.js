'use client';

import { ShieldCheck } from 'lucide-react';
import styles from '../../page.module.css';

export default function UsgPage() {
  return (
    <div className={styles.comingSoonBox}>
      <div className={styles.comingSoonIconBg} style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(40, 199, 154, 0.1)', color: '#28c79a', marginBottom: '1.5rem' }}>
        <ShieldCheck size={32} />
      </div>
      <h3 className={styles.comingSoonTitleText} style={{ fontSize: '18px', fontWeight: '700', color: '#2b2b3f', marginBottom: '8px' }}>Abdominal USG Status</h3>
      <p className={styles.comingSoonSubtext} style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
        This tab maps USG pathology findings (Grade of Fatty Liver, Kidney status, Prostatomegaly) into a couple's organ status radar.
        <br /><br />
        <strong style={{ color: '#d94386' }}>Currently Coming Soon under Premium plans.</strong>
      </p>
    </div>
  );
}
