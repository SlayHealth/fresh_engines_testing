import React from 'react';

const MODALITY_CONFIGS = {
  USG_ABDOMEN: { label: 'Abdomen USG', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  USG_ABDOMEN_PELVIS: { label: 'Abdomen + Pelvis USG', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
  USG_PELVIS: { label: 'Pelvis USG', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  USG_TVS: { label: 'TVS USG', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  USG_SCROTUM_DOPPLER: { label: 'Scrotum Doppler', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  ECHO: { label: 'Echocardiography (Echo)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  XRAY_CHEST: { label: 'Chest X-Ray', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
  USG_NECK: { label: 'Neck (Thyroid) USG', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  DEXA: { label: 'DEXA Bone Density', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  MRI_BRAIN: { label: 'Brain MRI', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  MRA_BRAIN: { label: 'Brain MRA', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  MRI_RENAL: { label: 'Renal MRI', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)' },
  MRA_AORTA: { label: 'Aorta MRA', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' }
};

export default function ModalityBadgeRow({ modalities }) {
  if (!modalities || modalities.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '20px 0' }}>
      {modalities.map(mKey => {
        const config = MODALITY_CONFIGS[mKey] || { label: mKey.replace('_', ' '), color: 'var(--muted)', bg: 'var(--glass-bg)' };
        return (
          <div
            key={mKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: '20px',
              border: `1px solid ${config.color}33`,
              background: config.bg,
              color: config.color,
              fontSize: '0.85rem',
              fontWeight: '600',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s',
              cursor: 'default'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span style={{ marginRight: '6px', fontSize: '0.75rem' }}>◉</span>
            {config.label}
          </div>
        );
      })}
    </div>
  );
}
