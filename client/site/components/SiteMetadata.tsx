import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import pages from 'virtual:baitly-site-metadata';
import { useSiteLanguage } from '../lib/siteLanguage';

export default function SiteMetadata() {
  const { pathname } = useLocation();
  const { language } = useSiteLanguage();
  useEffect(() => {
    const path = pathname.replace(/\/$/, '') || '/';
    const meta = pages[language][path] ?? pages[language]['/404'];
    const canonicalPath = pages[language][path]
      ? path === '/pre-lancement'
        ? '/bientot-disponible'
        : path
      : '/404';
    const origin = 'https://baitly.fr';
    const canonical = `${origin}${canonicalPath}${language === 'fr' ? '' : `?lang=${language}`}`;
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
    setMeta('name', 'robots', meta.index ? 'index, follow' : 'noindex, follow');
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('property', 'og:url', canonical);
    setMeta(
      'property',
      'og:locale',
      { fr: 'fr_FR', en: 'en_US', ar: 'ar_SA' }[language],
    );
    document.head
      .querySelectorAll('meta[property="og:locale:alternate"]')
      .forEach((node) => node.remove());
    for (const lang of ['fr', 'en', 'ar'] as const) {
      if (lang === language) continue;
      const node = document.createElement('meta');
      node.setAttribute('property', 'og:locale:alternate');
      node.content = { fr: 'fr_FR', en: 'en_US', ar: 'ar_SA' }[lang];
      document.head.append(node);
    }
    document.head
      .querySelectorAll('link[rel="canonical"],link[rel="alternate"][hreflang]')
      .forEach((node) => node.remove());
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonical;
    document.head.append(link);
    for (const lang of ['fr', 'en', 'ar', 'x-default']) {
      const alternate = document.createElement('link');
      alternate.rel = 'alternate';
      alternate.hreflang = lang;
      alternate.href = `${origin}${canonicalPath}${lang === 'fr' || lang === 'x-default' ? '' : `?lang=${lang}`}`;
      document.head.append(alternate);
    }
    // Pages d'épisode de l'Académie : aperçu et données VideoObject suivent la navigation, sans
    // rester sur la page suivante.
    setMeta('property', 'og:type', meta.video ? 'video.other' : 'website');
    setMeta('property', 'og:image', meta.video?.poster ?? `${origin}/baitly-share.jpg`);
    document.getElementById('baitly-video-ld')?.remove();
    if (meta.video) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'baitly-video-ld';
      script.textContent = JSON.stringify(meta.video.jsonLd);
      document.head.append(script);
    }
  }, [pathname, language]);
  return null;
}
