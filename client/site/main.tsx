import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SiteApp, { prepareSitePage } from './SiteApp';
import { SITE_LANGUAGES, type SiteLanguage } from './lib/siteLanguage';

async function mountSite() {
  const root = document.getElementById('root')!;
  const initialUrl = root.dataset.baitlyUrl;
  const language = document.documentElement.lang as SiteLanguage;
  const prepared = await prepareSitePage(window.location.pathname);
  const app = (
    <StrictMode>
      <BrowserRouter>
        <SiteApp
          prepared={prepared}
          initialUrl={initialUrl}
          initialLanguage={
            initialUrl && SITE_LANGUAGES.includes(language)
              ? language
              : undefined
          }
        />
      </BrowserRouter>
    </StrictMode>
  );
  // Keep the published DOM, focus and scroll position; attach interactions in place.
  if (initialUrl && root.hasChildNodes()) hydrateRoot(root, app);
  else createRoot(root).render(app);
}

void mountSite();
