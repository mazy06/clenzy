import { ChevronRight } from '../../src/icons/glyphs';
import { LAYOUT_MESSAGES } from '../lib/messages/layout';
import type { SiteLanguage } from '../lib/siteLanguage';
import { SITE_ORIGIN } from '../lib/siteSeo';

/**
 * Google's documented deeplink (developers.google.com/search/docs/appearance/preferred-sources),
 * chosen over its publisher.js button so no third-party script runs on Baitly pages.
 */
export const GOOGLE_PREFERRED_SOURCE_URL = `https://www.google.com/preferences/source?q=${new URL(SITE_ORIGIN).hostname}`;

/** Google's multicolour « G », inlined so the badge loads nothing from Google. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function GooglePreferredSourceBadge({
  language,
  className = '',
}: {
  language: SiteLanguage;
  className?: string;
}) {
  const m = LAYOUT_MESSAGES[language].footer.preferredSource;
  return (
    <a
      href={GOOGLE_PREFERRED_SOURCE_URL}
      target="_blank"
      rel="noopener"
      className={`group inline-flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card py-2.5 ps-3 pe-3.5 text-foreground no-underline transition-[border-color,background-color] duration-200 ease-out hover:border-foreground/30 hover:bg-muted/60 ${className}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <GoogleMark />
      </span>
      <span className="flex flex-col gap-0.5 text-start leading-tight">
        <span className="text-[11px] text-muted-foreground">{m.eyebrow}</span>
        <span className="text-[13px] font-semibold">{m.action}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        size={16}
        className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5 ${
          language === 'ar' ? '-scale-x-100 group-hover:-translate-x-0.5' : ''
        }`}
      />
    </a>
  );
}
