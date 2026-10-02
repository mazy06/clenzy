import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { createPath, Router, type Navigator } from 'react-router-dom';
import SiteApp, { prepareSitePage } from './SiteApp';
import type { SiteLanguage } from './lib/siteLanguage';

const cannotNavigate = () => {
  throw new Error('Navigation is unavailable while publishing a Baitly page');
};
// Public APIs shared by React Router 6 and 7 (no version-specific server entry).
const navigator: Navigator = {
  createHref: (to) => (typeof to === 'string' ? to : createPath(to)),
  go: cannotNavigate,
  push: cannotNavigate,
  replace: cannotNavigate,
};

/** The exact component tree mounted by main.tsx, including its useId/Suspense boundaries. */
export async function renderSite(pathname: string, language: SiteLanguage) {
  const url = `${pathname}?lang=${language}`;
  const prepared = await prepareSitePage(pathname);
  const html = renderToString(
    <StrictMode>
      <Router location={url} navigator={navigator} static>
        <SiteApp
          prepared={prepared}
          initialLanguage={language}
          initialUrl={url}
        />
      </Router>
    </StrictMode>,
  );
  // renderToString can swallow a route error inside Suspense. Publishing its fallback
  // would recreate the very flash this renderer is meant to prevent.
  if (html.includes('<!--$!-->') || html.includes('site-route-loading')) {
    throw new Error(`Incomplete Baitly render: ${url}`);
  }
  return { html, url };
}
