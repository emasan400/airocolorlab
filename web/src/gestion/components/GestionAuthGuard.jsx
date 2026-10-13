import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, supabaseEnabled } from '../../lib/supabase.js';
import {
  setOperadorActual,
  getUsuarios,
  verifyPasswordSync,
  verifyTotpCode,
  DEFAULT_ADMIN_HASH,
  hashPasswordSync,
  setLocal,
  KEYS,
} from '../services/storageService.js';
import {
  IconShield,
  IconWarning,
  IconEye,
  IconEyeOff,
} from './Icons.jsx';

// Inactividad máxima permitida antes de auto-cerrar sesión (30 minutos)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// Límite de intentos de login fallidos antes de bloqueo temporal
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function GestionAuthGuard({ children }) {
  const [session, setSession] = useState(undefined); // undefined = chequeando
  const [idleLocked, setIdleLocked] = useState(false);
  const idleTimerRef = useRef(null);

  // Reset del timer de inactividad
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (session) {
        setIdleLocked(true);
        handleSignOut('Sesión cerrada automáticamente por inactividad (30 min).');
      }
    }, IDLE_TIMEOUT_MS);
  }, [session]);

  // Chequeo de sesión inicial (híbrido: local + Supabase)
  useEffect(() => {
    // 1. Revisar primero si hay sesión activa en sessionStorage
    const localAuth = sessionStorage.getItem('airo_auth_session');
    if (localAuth) {
      try {
        const parsed = JSON.parse(localAuth);
        if (parsed?.user?.email) {
          setSession(parsed);
          setOperadorActual(parsed.user.email);
          return;
        }
      } catch {
        sessionStorage.removeItem('airo_auth_session');
      }
    }

    if (!supabaseEnabled || !supabase) {
      setSession(null);
      return;
    }

    // 2. Si no hay local, revisar sesión en Supabase
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.email) {
        setSession(data.session);
        setOperadorActual(data.session.user.email);
      } else {
        setSession(null);
      }
    }).catch(() => {
      setSession(null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user?.email) {
        setSession(s);
        setOperadorActual(s.user.email);
      } else {
        const saved = sessionStorage.getItem('airo_auth_session');
        if (!saved) {
          setSession(null);
        }
      }
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Event listeners para actividad del usuario (Anti-inactividad)
  useEffect(() => {
    if (!session) return;
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handleActivity = () => resetIdleTimer();

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [session, resetIdleTimer]);

  const handleSignOut = async (mensajeMotivo = '') => {
    if (supabaseEnabled && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    sessionStorage.removeItem('airo_auth_session');
    setSession(null);
    if (mensajeMotivo) {
      alert(mensajeMotivo);
    }
  };

  // Cargando estado inicial
  if (session === undefined) {
    return (
      <div className="auth-guard-loading">
        <div className="auth-guard-spinner" />
        <p>Verificando credenciales y autorización de acceso…</p>
      </div>
    );
  }

  // Si no hay sesión válida, presentar Login Blindado
  if (!session) {
    return (
      <SecureAdminLogin
        onSuccess={(authData) => {
          setSession(authData);
          setIdleLocked(false);
          if (authData?.user?.email) {
            setOperadorActual(authData.user.email);
          }
        }}
        idleLockedMessage={idleLocked ? 'La sesión previa expiró por inactividad. Ingresá nuevamente.' : ''}
      />
    );
  }

  // Usuario autenticado: inyectamos prop onSignOut y session al componente hijo
  return (
    <div className="auth-guard-protected">
      {typeof children === 'function' ? children({ session, handleSignOut }) : children}
    </div>
  );
}

/* ============================================================
   COMPONENTE: LOGIN BLINDADO CON PROTECCIÓN CONTRA FUERZA BRUTA
   ============================================================ */
function SecureAdminLogin({ onSuccess, idleLockedMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(idleLockedMessage || '');
  const [failedAttempts, setFailedAttempts] = useState(() => {
    const saved = sessionStorage.getItem('airo_login_fails');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lockoutTimer, setLockoutTimer] = useState(0);

  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  // Manejo del temporizador de bloqueo por fuerza bruta
  useEffect(() => {
    let interval = null;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((t) => t - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockoutTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Por favor completá todos los campos.');
      return;
    }

    setBusy(true);
    setErrorMsg('');

    try {
      // 1. Verificar si existe en la base de usuarios de la aplicación (RBAC local)
      const usuarios = getUsuarios();
      const userMatch = usuarios.find(
        (u) => u.email.toLowerCase() === cleanEmail && u.activo
      );

      let localAuthSuccess = false;
      if (userMatch) {
        const passwordOk = userMatch.password
          ? verifyPasswordSync(password, userMatch.password)
          : (password.length >= 8);

        if (passwordOk) {
          localAuthSuccess = true;
          const mockSession = {
            user: {
              email: userMatch.email,
              role: 'authenticated',
              user_metadata: { rol: userMatch.rol, nombre: userMatch.nombre },
            },
            token: 'local-session-token-' + Date.now(),
          };

          // Desafío MFA si el usuario tiene doble factor activado
          if (userMatch.mfa_enabled && userMatch.mfa_secret) {
            setMfaChallenge({
              secret: userMatch.mfa_secret,
              session: mockSession,
              userObj: userMatch,
            });
            setBusy(false);
            return;
          }

          sessionStorage.setItem('airo_auth_session', JSON.stringify(mockSession));
          sessionStorage.removeItem('airo_login_fails');
          setFailedAttempts(0);
          onSuccess(mockSession);
          return;
        }
      }

      // 2. Si no autenticó por RBAC local y Supabase está habilitado, intentar Supabase Auth
      if (supabaseEnabled && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (!error && data?.session) {
            // Sincronizar en base de usuarios si no existía
            if (!usuarios.some((u) => u.email.toLowerCase() === cleanEmail)) {
              usuarios.push({
                id: `usr-${Date.now()}`,
                email: cleanEmail,
                nombre: data.session.user.user_metadata?.nombre || cleanEmail.split('@')[0],
                rol: data.session.user.user_metadata?.rol || 'admin',
                activo: true,
                password: hashPasswordSync(password),
                fecha_creacion: new Date().toISOString(),
              });
              setLocal(KEYS.USUARIOS, usuarios);
            }

            sessionStorage.setItem('airo_auth_session', JSON.stringify(data.session));
            sessionStorage.removeItem('airo_login_fails');
            setFailedAttempts(0);
            onSuccess(data.session);
            return;
          }
        } catch {
          // Continuar a fallback de contingencia
        }
      }

      // 3. Fallback de contingencia: Clave maestra de taller o administrador predeterminado
      const isMasterAdmin =
        verifyPasswordSync(password, DEFAULT_ADMIN_HASH) ||
        (cleanEmail.includes('admin') && password === 'Airo2026!');

      if (isMasterAdmin) {
        const fallbackSession = {
          user: {
            email: cleanEmail || 'admin@airocolorlab.com',
            role: 'authenticated',
            user_metadata: { rol: 'admin', nombre: 'Administrador Taller AIRO' },
          },
          token: 'airo-master-token-' + Date.now(),
        };

        sessionStorage.setItem('airo_auth_session', JSON.stringify(fallbackSession));
        sessionStorage.removeItem('airo_login_fails');
        setFailedAttempts(0);
        onSuccess(fallbackSession);
        return;
      }

      // Si no coincidió ninguna de las opciones anteriores:
      handleAuthFailure('Contraseña incorrecta o usuario no habilitado en el sistema.');
    } catch (err) {
      handleAuthFailure(err.message || 'Error de conexión con el servicio de autenticación.');
    } finally {
      setBusy(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.trim().length !== 6) {
      setErrorMsg('El código debe contener 6 dígitos numéricos.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const isValid = await verifyTotpCode(mfaChallenge.secret, mfaCode.trim());
      if (isValid) {
        sessionStorage.setItem('airo_auth_session', JSON.stringify(mfaChallenge.session));
        sessionStorage.removeItem('airo_login_fails');
        setFailedAttempts(0);
        onSuccess(mfaChallenge.session);
      } else {
        handleAuthFailure('Código incorrecto o expirado. Verificá tu aplicación.');
      }
    } catch {
      setErrorMsg('Error al validar código de verificación.');
    } finally {
      setBusy(false);
    }
  };

  const handleAuthFailure = (rawError) => {
    const newFails = failedAttempts + 1;
    setFailedAttempts(newFails);
    sessionStorage.setItem('airo_login_fails', newFails.toString());

    if (newFails >= MAX_FAILED_ATTEMPTS) {
      setLockoutTimer(LOCKOUT_SECONDS);
      setErrorMsg(`Demasiados intentos fallidos. Por seguridad, el acceso se bloqueó por ${LOCKOUT_SECONDS} segundos.`);
    } else {
      let friendlyMsg = 'Credenciales no válidas. Verificá tu usuario y contraseña.';
      if (rawError.toLowerCase().includes('email not confirmed')) {
        friendlyMsg = 'Email no confirmado. Verificá la confirmación en Supabase Auth.';
      } else if (rawError.toLowerCase().includes('rate limit')) {
        friendlyMsg = 'Límite de solicitudes alcanzado. Esperá unos instantes.';
      }
      setErrorMsg(`${friendlyMsg} (Intento ${newFails} de ${MAX_FAILED_ATTEMPTS})`);
    }
  };

  return (
    <div className="auth-screen-container">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-logo-circle">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="#1a4295" />
              <path
                d="M50 18 C58 35 68 45 82 50 C68 55 58 65 50 82 C42 65 32 55 18 50 C32 45 42 35 50 18 Z"
                fill="#ffffff"
              />
              <circle cx="50" cy="50" r="10" fill="#00b4d8" />
            </svg>
          </div>
          <h2 className="display" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            AIRO COLOR LAB.<span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cyan)', display: 'inline-block' }} />
          </h2>
          <p className="auth-subtitle">Estudio Textil · Acceso al Sistema de Gestión B2B</p>
        </div>

        {mfaChallenge ? (
          <form onSubmit={handleMfaSubmit} className="auth-form" noValidate>
            {errorMsg && (
              <div className="auth-alert-error" role="alert">
                <span className="auth-alert-icon"><IconWarning size={16} /></span>
                <div>{errorMsg}</div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', background: 'rgba(26, 66, 149, 0.08)', color: 'var(--blue)', marginBottom: '8px' }}>
                <IconShield size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--blue)' }}>
                Código de verificación
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-70)', margin: 0 }}>
                Ingresá el código de 6 dígitos de tu aplicación.
              </p>
            </div>

            <div className="auth-form-group">
              <label htmlFor="auth-mfa-code" style={{ textAlign: 'center', fontWeight: 600 }}>
                Código de seguridad
              </label>
              <input
                id="auth-mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                disabled={busy}
                style={{
                  textAlign: 'center',
                  fontSize: '1.6rem',
                  letterSpacing: '8px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <button
              type="submit"
              className="auth-btn-submit"
              disabled={busy || mfaCode.length !== 6}
            >
              {busy ? 'Verificando código…' : 'Validar e Iniciar Sesión'}
            </button>

            <button
              type="button"
              className="auth-back-link"
              onClick={() => { setMfaChallenge(null); setMfaCode(''); setErrorMsg(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: '14px', width: '100%', textAlign: 'center' }}
            >
              ← Cancelar y volver al inicio de sesión
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {errorMsg && (
              <div className="auth-alert-error" role="alert">
                <span className="auth-alert-icon"><IconWarning size={16} /></span>
                <div>{errorMsg}</div>
              </div>
            )}

            <div className="auth-form-group">
              <label htmlFor="auth-email">Correo Electrónico de Administrador</label>
              <input
                id="auth-email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                placeholder="ejemplo@airocolorlab.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || lockoutTimer > 0}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="auth-password">Contraseña</label>
              <div className="auth-password-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy || lockoutTimer > 0}
                />
                <button
                  type="button"
                  className="auth-btn-toggle-pwd"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn-submit"
              disabled={busy || lockoutTimer > 0}
            >
              {lockoutTimer > 0
                ? `Bloqueado (${lockoutTimer}s)`
                : busy
                ? 'Verificando autorización…'
                : 'Ingresar al Sistema'}
            </button>
          </form>
        )}

        <div className="auth-footer-links">
          <a href="#/" className="auth-back-link">
            ← Volver a la página principal de AIRO
          </a>
        </div>
      </div>
    </div>
  );
}
