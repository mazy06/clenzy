import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import { useSiteLaunch } from '../lib/siteLaunch';
import DemoPage from '../pages/DemoPage';
import PrelaunchPage from '../pages/PrelaunchPage';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';

function LaunchLoading() {
  const { language } = useSiteLanguage();
  return (
    <p className="site-shell py-20" role="status">
      {PRELAUNCH_MESSAGES[language].loading}
    </p>
  );
}

export function DemoRoute() {
  const { paused, loading } = useSiteLaunch();
  const { search } = useLocation();
  // Publish the actual demo page while checking availability. Submission stays
  // disabled until the server has confirmed that this journey is open.
  return !loading && paused ? (
    <Navigate to={`/bientot-disponible${search}`} replace />
  ) : (
    <DemoPage disabled={loading} />
  );
}

export function RegistrationRoute() {
  const { paused, loading } = useSiteLaunch();
  const { search } = useLocation();
  useEffect(() => {
    if (!loading && !paused) {
      const base = runtimeEnvOr(
        'VITE_APP_URL',
        'http://localhost:3000',
      ).replace(/\/+$/, '');
      window.location.replace(`${base}/inscription${search}`);
    }
  }, [loading, paused, search]);
  if (loading) return <LaunchLoading />;
  return paused ? (
    <Navigate to={`/bientot-disponible${search}`} replace />
  ) : (
    <PrelaunchPage />
  );
}
