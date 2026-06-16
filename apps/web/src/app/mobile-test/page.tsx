/** Zero-JS connectivity check — if this is blank, the phone is not reaching your PC. */
export default function MobileTestPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#0d1b2a',
        color: '#ffffff',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>LMS — connection OK</h1>
      <p style={{ lineHeight: 1.6, marginBottom: '1rem' }}>
        Your phone reached the dev server on this PC. Network and firewall are working for
        this page.
      </p>
      <p style={{ lineHeight: 1.6, marginBottom: '1.5rem', opacity: 0.85 }}>
        Next: open the full app home page. If home is blank but this page works, it was a
        JavaScript loading issue (now fixed).
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.25rem',
          background: '#00a676',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Open LMS home
      </a>
    </main>
  );
}
