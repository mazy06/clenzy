import { lazy, Suspense } from 'react';
import { SiteLanguageProvider } from '../../../site/lib/siteLanguage';
import {
  SiteLaunchProvider,
  useSiteLaunch,
} from '../../../site/lib/siteLaunch';
import PrelaunchPage from '../../../site/pages/PrelaunchPage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import RouteFallback from '../../components/RouteFallback';
import '../../../site/home.css';

const Inscription = lazy(() => import('./Inscription'));

function RegistrationGate() {
  const { paused } = useSiteLaunch();
  if (!paused)
    return (
      <Suspense fallback={<RouteFallback />}>
        <Inscription />
      </Suspense>
    );
  return (
    <SiteLanguageProvider>
      <div className="baitly-marketing">
        <header className="prelaunch-app-header">
          <a href="/login" aria-label="Baitly">
            <BaitlyMarkLogo variant="full" size={30} />
          </a>
        </header>
        <main>
          <PrelaunchPage applicationEntry />
        </main>
      </div>
    </SiteLanguageProvider>
  );
}

export default function RegistrationEntry() {
  return (
    <SiteLaunchProvider>
      <RegistrationGate />
    </SiteLaunchProvider>
  );
}
