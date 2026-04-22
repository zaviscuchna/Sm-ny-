'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="cs">
      <body>
        <div style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '40px 20px',
          maxWidth: 720,
          margin: '0 auto',
          color: '#334155',
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Něco se pokazilo</h1>
          <p style={{ marginBottom: 16, color: '#64748b' }}>
            Aplikace narazila na chybu. Pošli prosím screenshot této stránky pro další diagnostiku.
          </p>
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>Chyba:</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#7f1d1d', wordBreak: 'break-word' }}>
              {error.message || 'Neznámá chyba'}
            </div>
            {error.digest && (
              <div style={{ fontSize: 11, color: '#991b1b', marginTop: 8 }}>
                Digest: <code>{error.digest}</code>
              </div>
            )}
            {error.stack && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 12, cursor: 'pointer', color: '#991b1b' }}>Stack trace</summary>
                <pre style={{ fontSize: 11, overflow: 'auto', marginTop: 8, color: '#7f1d1d' }}>
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{
              background: '#4f46e5',
              color: 'white',
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}>Zkusit znovu</button>
            <a href="/login" style={{
              background: 'white',
              color: '#334155',
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              fontWeight: 600,
            }}>Na přihlášení</a>
          </div>
        </div>
      </body>
    </html>
  )
}
