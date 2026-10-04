import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import Privacy from './components/Privacy.jsx';
import Terms from './components/Terms.jsx';
import NotFound from './components/NotFound.jsx';

// Admin + Supabase se descargan solo al entrar a #/admin (code splitting)
const Admin = lazy(() => import('./admin/Admin.jsx'));

function Router() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (hash.startsWith('#/admin')) {
    return (
      <Suspense fallback={<div className="admin-login">Cargando…</div>}>
        <Admin />
      </Suspense>
    );
  }
  if (hash.startsWith('#/privacidad')) return <Privacy />;
  if (hash.startsWith('#/terminos')) return <Terms />;
  if (hash !== '#/' && hash.startsWith('#/')) return <NotFound />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
