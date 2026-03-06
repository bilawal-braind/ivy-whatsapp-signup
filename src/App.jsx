import { useState, useEffect, useRef, useCallback } from 'react';

// If frontend and backend are on different domains (e.g. separate AWS deployments),
// set VITE_API_URL in frontend/.env to your API Gateway URL.
// If on the same domain (CloudFront routing), leave it empty — relative paths work.
const API_URL = import.meta.env.VITE_API_URL || '';

// ─── SVG icons ────────────────────────────────────────────────────────────────

// Ivy leaf icon — rounded leaf with stem, matches official brand style
const LeafIcon = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M6.5 17.5C6.5 17.5 6 11 10 8C14 5 20 5.5 20 5.5C20 5.5 20 11.5 16 14.5C12 17.5 6.5 17.5 6.5 17.5Z"
      fill={color}
    />
    <path
      d="M6.5 17.5C8 14 10 12 13 10.5"
      stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.5"
    />
    <path
      d="M5 20C5.5 18.5 6 18 6.5 17.5"
      stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none"
    />
  </svg>
);

const WAIcon = () => (
  <svg width={30} height={30} viewBox="0 0 24 24" fill="#2db36f">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FBIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="white">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

// ─── Step row in the processing modal ─────────────────────────────────────────

function StepRow({ number, state, doneLabel, pendingLabel }) {
  const label = state === 'done' ? doneLabel : pendingLabel;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 13 }}>
      <div className={`step-icon step-${state}`}>
        {state === 'done' ? '✓' : state === 'wait' ? number : ''}
      </div>
      <span className={`step-text step-text-${state}`}>{label}</span>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  // 'idle' | 'processing' | 'success'
  const [phase,   setPhase]   = useState('idle');
  const [step2,   setStep2]   = useState('active'); // step states: 'active' | 'done' | 'wait'
  const [step3,   setStep3]   = useState('wait');
  const [result,  setResult]  = useState(null);

  // These are refs (not state) because they're set inside event listeners
  // and read inside the async fbLoginCallback — refs are always fresh.
  const wabaIdRef  = useRef(null);
  const phoneIdRef = useRef(null);

  // Called by FB.login callback AND by the /callback redirect message listener.
  // Defined with useCallback so the effect dependency is stable.
  // FB.login callback MUST be synchronous — async IIFE handles the async work inside
  const fbLoginCallback = useCallback((response) => {
    if (!response.authResponse) {
      console.log('[ES] Popup closed without completing');
      return;
    }

    const code = response.authResponse.code;
    console.log('[ES] Got auth code, calling backend to exchange...');

    setPhase('processing');
    setStep2('active');
    setStep3('wait');

    (async () => { try {
      const res = await fetch(`${API_URL}/api/exchange-token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          code,
          waba_id:         wabaIdRef.current,
          phone_number_id: phoneIdRef.current,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        const msg = data.error?.message || JSON.stringify(data.error) || 'Token exchange failed';
        throw new Error(msg);
      }

      // Animate the progress steps
      setTimeout(() => setStep2('done'),    400);
      setTimeout(() => setStep3('active'),  600);
      setTimeout(() => setStep3('done'),   1200);
      setTimeout(() => {
        setResult(data.data);
        setPhase('success');
      }, 1600);

    } catch (err) {
      console.error('[ES] Error during token exchange:', err);
      setPhase('idle');
      alert('Setup failed: ' + err.message + '\n\nCheck the browser console for details.');
    } })();
  }, []); // no deps — relies only on refs and stable setters

  useEffect(() => {
    // Init FB SDK — fbAsyncInit must be set before the SDK script loads
    window.fbAsyncInit = () => {
      window.FB.init({
        appId:            '2151299869012770',
        autoLogAppEvents: true,
        xfbml:            true,
        version:          'v22.0',
      });
    };

    // Inject the SDK script (only once)
    if (!document.getElementById('fb-sdk')) {
      const script       = document.createElement('script');
      script.id          = 'fb-sdk';
      script.src         = 'https://connect.facebook.net/en_US/sdk.js';
      script.async       = true;
      script.defer       = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    // Handle the ?code= redirect from /callback (window.open fallback flow)
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      fbLoginCallback({ authResponse: { code } });
    }

    // Listen for messages from Meta's popup and from our /callback page
    const handleMessage = (event) => {
      // Our /callback page passes the code back via postMessage
      if (event.data?.type === 'WA_CODE') {
        console.log('[ES] Got code from /callback popup');
        fbLoginCallback({ authResponse: { code: event.data.code } });
        return;
      }

      // Meta sends WABA + phone_number_id via postMessage when signup finishes
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
            wabaIdRef.current  = data.data.waba_id;
            phoneIdRef.current = data.data.phone_number_id;
            console.log('[ES] WABA:', wabaIdRef.current, '| Phone:', phoneIdRef.current);
          } else if (data.event === 'CANCEL') {
            console.warn('[ES] User cancelled at step:', data.data.current_step);
          } else if (data.event === 'ERROR') {
            console.error('[ES] Signup error:', data.data.error_message);
          }
        }
      } catch {
        // non-JSON messages from Meta, ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fbLoginCallback]);

  // Fires the real Meta Embedded Signup popup — do not change config_id or params
  const launchWhatsAppSignup = () => {
    wabaIdRef.current  = null;
    phoneIdRef.current = null;

    window.FB.login(fbLoginCallback, {
      config_id:                      '933321519187569',
      response_type:                  'code',
      override_default_response_type: true,
      extras: { setup: {} },
    });
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .step-icon {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; flex-shrink: 0;
        }
        .step-done   { background: #d1fae5; color: #059669; }
        .step-active { border: 2px solid #d1fae5; border-top-color: #2db36f; animation: spin 0.8s linear infinite; }
        .step-wait   { background: #f3f4f6; color: #9ca3af; }

        .step-text-done   { color: #374151; }
        .step-text-active { color: #2db36f; font-weight: 500; }
        .step-text-wait   { color: #9ca3af; }
      `}</style>

      {/* ── Page background ── */}
      <div style={s.page}>

        {/* ── Ivy top bar ── */}
        <div style={s.topbar}>
          <div style={s.logoCircle}><LeafIcon size={17} /></div>
          <span style={s.logoText}>Ivy</span>
        </div>

        {/* ── Main content ── */}
        <div style={s.content}>

          {/* ── Hero text ── */}
          <div style={s.hero}>
            <h1 style={s.heroTitle}>Welcome to Ivy.</h1>
            <p style={s.heroSub}>Link your WhatsApp Business account to complete your onboarding. It only takes about 2 minutes.</p>
          </div>

          {/* ── Two-column layout ── */}
          <div style={s.columns}>

            {/* Left — What you'll need */}
            <div style={s.leftCard}>
              <p style={s.reqTitle}>What you'll need</p>

              {[
                {
                  svg: (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="#16a34a">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  ),
                  label: 'A Facebook account',
                  note: "You'll use this to log in and authorise the connection. No Facebook account yet? You can create one for free right at the start of the process.",
                },
                {
                  svg: (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="#16a34a">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                    </svg>
                  ),
                  label: 'A Meta Business Portfolio',
                  note: "This is where your WhatsApp Business Account will live. If you don't have one, you can create it inside the signup flow — it takes less than a minute.",
                },
                {
                  svg: (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="#16a34a">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.03 21 3 13.97 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.01l-2.2 2.21z"/>
                    </svg>
                  ),
                  label: 'A phone number for WhatsApp',
                  note: "Any phone number that can receive an OTP (SMS or call) works. You do not need to have the WhatsApp Business app installed — this connects via the API.",
                },
              ].map(({ svg, label, note }) => (
                <div key={label} style={s.reqItem}>
                  <div style={s.reqIcon}>{svg}</div>
                  <div>
                    <div style={s.reqLabel}>{label}</div>
                    <div style={s.reqNote}>{note}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right — Connect card */}
            <div style={s.card}>
              <div style={s.waIconWrap}><WAIcon /></div>

              <h2 style={s.title}>
                Ready to connect?
              </h2>

              <p style={s.desc}>
                Click below to securely link your WhatsApp Business account to Ivy via Facebook.
              </p>

              <div style={s.bullets}>
                {[
                  'Takes about 2 minutes to complete.',
                  'We only request the permissions needed to send and receive messages on your behalf.',
                  'Your credentials are encrypted and stored securely.',
                ].map((text, i) => (
                  <div key={i} style={{ ...s.bullet, marginBottom: i < 2 ? 10 : 0 }}>
                    <div style={s.dot} />
                    {text}
                  </div>
                ))}
              </div>

              <button style={s.btnConnect} onClick={launchWhatsAppSignup}
                onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
                onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}>
                <FBIcon />
                Continue with Facebook
              </button>

              <p style={s.footNote}>Secured by Meta · Powered by Ivy</p>
            </div>

          </div>{/* /columns */}

        </div>{/* /content */}

        {/* ── Overlay (shown during processing + success) ── */}
        {phase !== 'idle' && (
          <div style={s.overlay}>

            {/* Processing modal */}
            {phase === 'processing' && (
              <div style={s.modal}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 16 }}>
                    <div style={s.logoCircleSmall}><LeafIcon size={13} /></div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Ivy</span>
                  </div>
                  <div style={s.spinner} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    Setting up your account
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    Configuring your WhatsApp Business account...
                  </div>
                </div>

                <StepRow number={1} state="done"  doneLabel="Facebook login verified"            pendingLabel="Facebook login verified" />
                <StepRow number={2} state={step2} doneLabel="Linked WhatsApp Business Account"   pendingLabel="Linking WhatsApp Business Account..." />
                <StepRow number={3} state={step3} doneLabel="Credentials saved"                  pendingLabel="Saving credentials to Ivy..." />
              </div>
            )}

            {/* Success modal */}
            {phase === 'success' && (
              <div style={{ ...s.modal, padding: 0 }}>
                <div style={{ padding: '36px 28px 24px' }}>
                  <div style={s.succIconWrap}>
                    <svg viewBox="0 0 24 24" fill="#059669" width={26} height={26}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    WhatsApp Connected!
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 22 }}>
                    Your WhatsApp Business account is now linked to Ivy. You're all set — our team will be in touch shortly.
                  </div>
                  <div style={s.succBox}>
                    {[
                      ['Phone Number ID', result?.phone_number_id || '—'],
                      ['WABA ID',         result?.waba_id         || '—'],
                      ['Business',        result?.client_name     || '—'],
                      ['Status',          'Active'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{
                          color:      label === 'Status' ? '#059669' : '#111827',
                          fontWeight: 500,
                          fontFamily: label === 'Status' ? 'inherit' : 'monospace',
                          fontSize:   12,
                        }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '0 28px 28px' }}>
                  <button style={s.btnDone} onClick={() => setPhase('idle')}
                    onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
                    onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}>
                    Done
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    backgroundColor: '#f0f9f4',
    backgroundImage: [
      'linear-gradient(rgba(45,179,111,0.07) 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(45,179,111,0.07) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: '36px 36px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingBottom: 24,
    paddingLeft: 24,
    paddingRight: 24,
  },
  topbar: {
    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 100,
    padding: '8px 20px 8px 8px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
    zIndex: 10,
  },
  logoCircle: {
    width: 36, height: 36, background: '#22c55e', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoCircleSmall: {
    width: 24, height: 24, background: '#22c55e', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.4px',
  },
  content: {
    width: '100%', maxWidth: 900,
    display: 'flex', flexDirection: 'column', alignItems: 'stretch',
    gap: 20,
  },
  hero: {
    textAlign: 'center', paddingBottom: 4,
  },
  heroTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 36, fontWeight: 700, color: '#1a5c35',
    letterSpacing: '-0.3px', marginBottom: 8, lineHeight: 1.2,
  },
  heroSub: {
    fontSize: 15, color: '#64748b', lineHeight: 1.6,
  },
  // Two-column row
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    alignItems: 'stretch',
  },
  // Left card — requirements
  leftCard: {
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 20,
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    padding: '24px 24px',
  },
  reqTitle: {
    fontSize: 11, fontWeight: 700, color: '#94a3b8',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18,
  },
  reqItem: {
    display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20,
  },
  reqIcon: {
    width: 38, height: 38, borderRadius: 10,
    background: '#f0fdf4', border: '1px solid #dcfce7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  reqLabel: {
    fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4,
  },
  reqNote: {
    fontSize: 13, color: '#64748b', lineHeight: 1.6,
  },
  // Right — connect card
  card: {
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 20,
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    padding: '28px 28px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  waIconWrap: {
    width: 56, height: 56,
    background: 'linear-gradient(135deg, #bbf7d0, #dcfce7)',
    borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: 24, fontWeight: 700, color: '#0f172a',
    letterSpacing: '-0.6px', marginBottom: 8, lineHeight: 1.3,
    textAlign: 'center',
  },
  desc: {
    fontSize: 15, color: '#64748b', lineHeight: 1.65, marginBottom: 24,
    textAlign: 'center',
  },
  bullets: {
    background: '#f8fffe',
    border: '1px solid #d1fae5',
    borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: 'left',
    marginTop: 'auto',
  },
  bullet: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    fontSize: 14, color: '#334155',
  },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#22c55e', flexShrink: 0, marginTop: 6,
  },
  btnConnect: {
    width: '100%', background: '#16a34a', border: 'none', borderRadius: 100,
    color: '#fff', fontSize: 14, fontWeight: 600, padding: '14px 20px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    letterSpacing: '-0.1px',
    boxShadow: '0 1px 3px rgba(22,163,74,0.3)',
  },
  footNote: {
    fontSize: 11.5, color: '#94a3b8', marginTop: 16, letterSpacing: '0.1px',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    backdropFilter: 'blur(6px)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#fff', borderRadius: 20, width: 420,
    boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
    padding: '36px 28px 28px',
    border: '1px solid rgba(0,0,0,0.05)',
  },
  spinner: {
    width: 36, height: 36,
    border: '2.5px solid #dcfce7', borderTopColor: '#22c55e',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    margin: '0 auto 14px',
  },
  succIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    background: 'linear-gradient(135deg, #bbf7d0, #dcfce7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  succBox: {
    background: '#f8fffe', border: '1px solid #d1fae5',
    borderRadius: 12, padding: '14px 16px',
  },
  btnDone: {
    width: '100%', background: '#16a34a', border: 'none', borderRadius: 100,
    color: '#fff', fontSize: 14, fontWeight: 600, padding: 13, cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(22,163,74,0.3)',
  },
};
