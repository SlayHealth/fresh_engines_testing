'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Next.js Global Error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      color: '#fff',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--error)',
        padding: '2rem',
        borderRadius: '12px',
        maxWidth: '500px'
      }}>
        <AlertTriangle size={48} color="var(--error)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ marginBottom: '1rem', color: 'var(--error)' }}>Something went wrong!</h2>
        <p style={{ color: '#d1d5db', marginBottom: '2rem', lineHeight: '1.5' }}>
          An unexpected error occurred in the application interface. The development team has been notified.
        </p>
        
        {/* Optional: show error message in dev mode */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '2rem',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: '#f87171',
            overflowX: 'auto'
          }}>
            {error.message}
          </div>
        )}

        <button
          onClick={() => reset()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.75rem',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '1rem'
          }}
        >
          <RefreshCcw size={18} />
          Try again
        </button>
      </div>
    </div>
  );
}
