import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { robotsDirective } from '../lib/siteSeo';

export default function SiteMetadata() {
  const { pathname } = useLocation();
  const { language } = useSiteLanguage();
  // The initial document already has its complete head. Do not download every
  // page's metadata just to write that same head again during hydration.
  const currentMetadata = useRef(
    typeof document === 'undefined'
      ? undefined
      : document.getElementById('root')?.dataset.baitlyUrl,
  );
  useEffect(() => {
    const path = pathname.replace(/\/$/, '') || '/';
    const key = `${path}?lang=${language}`;
    if (currentMetadata.current === key) return;
    let active = true;
    void import('virtual:baitly-site-metadata').then(({ default: pages }) => {
      if (!active) return;
      currentMetadata.current = key;
      const meta = pages[language][path] ?? pages[language]['/404'];
      const canonicalPath = pages[language][path]
        ? path === '/pre-lancement'
          ? '/bientot-disponible'
          : path
        : '/404';
      const origin = 'https://baitly.fr';
      const contentLanguage = meta.contentLanguage ?? language;
      const canonical = `${origin}${canonicalPath}${contentLanguage === 'fr' ? '' : `?lang=${contentLanguage}`}`;
      document.title = meta.title;
      const setMeta = (
        attribute: 'name' | 'property',
        key: string,
        value: string,
      ) => {
        let node = document.head.querySelector<HTMLMetaElement>(
          `meta[${attribute}="${key}"]`,
        );
        if (!node) {
          node = document.createElement('meta');
          node.setAttribute(attribute, key);
          document.head.append(node);
        }
        node.content = value;
      };
      setMeta('name', 'description', meta.description);
      setMeta(
        'name',
        'robots',
        robotsDirective(meta.index, Boolean(meta.video)),
      );
      setMeta('property', 'og:title', meta.title);
      setMeta('property', 'og:description', meta.description);
      setMeta('property', 'og:url', canonical);
      setMeta(
        'property',
        'og:locale',
        { fr: 'fr_FR', en: 'en_US', ar: 'ar_SA' }[contentLanguage],
      );
      document.head
        .querySelectorAll('meta[property="og:locale:alternate"]')
        .forEach((node) => node.remove());
      for (const lang of meta.availableLanguages ??
        (['fr', 'en', 'ar'] as const)) {
        if (lang === contentLanguage) continue;
        const node = document.createElement('meta');
        node.setAttribute('property', 'og:locale:alternate');
        node.content = { fr: 'fr_FR', en: 'en_US', ar: 'ar_SA' }[lang];
        document.head.append(node);
      }
      document.head
        .querySelectorAll(
          'link[rel="canonical"],link[rel="alternate"][hreflang]',
        )
        .forEach((node) => node.remove());
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = canonical;
      document.head.append(link);
      for (const lang of [
        ...(meta.availableLanguages ?? ['fr', 'en', 'ar']),
        'x-default',
      ]) {
        const alternate = document.createElement('link');
        alternate.rel = 'alternate';
        alternate.hreflang = lang;
        alternate.href = `${origin}${canonicalPath}${lang === 'fr' || lang === 'x-default' ? '' : `?lang=${lang}`}`;
        document.head.append(alternate);
      }
      // Pages d'épisode de l'Académie : aperçu et données VideoObject suivent la navigation, sans
      // rester sur la page suivante.
      setMeta(
        'property',
        'og:type',
        meta.video
          ? 'video.other'
          : meta.contentLanguage
            ? 'article'
            : 'website',
      );
      setMeta(
        'property',
        'og:image',
        meta.image ?? meta.video?.poster ?? `${origin}/baitly-share.jpg`,
      );
      document.getElementById('baitly-video-ld')?.remove();
      document.getElementById('baitly-editorial-ld')?.remove();
      if (meta.structuredData) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'baitly-editorial-ld';
        script.textContent = JSON.stringify(meta.structuredData);
        document.head.append(script);
      }
      if (meta.video) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'baitly-video-ld';
        script.textContent = JSON.stringify(meta.video.jsonLd);
        document.head.append(script);
      }
    });
    return () => {
      active = false;
    };
  }, [pathname, language]);
  return null;
}
