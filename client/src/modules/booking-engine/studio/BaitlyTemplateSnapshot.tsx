import { useMemo } from 'react';
import type { GalleryTemplate } from './grapes/import/galleryTemplates';
import { materializeBaitlyJourneyTemplate, type BaitlyTemplateProperty } from './grapes/import/baitlyJourneyTemplates';
import './baitlyTemplateSnapshot.css';
import { API_CONFIG } from '../../../config/api';
import { addBaitlyTemplateLogos } from './grapes/import/baitlyTemplateLogos';

/** Read-only thumbnail of the actual native page; never a separate device preview or a live booking. */
export default function BaitlyTemplateSnapshot({ template, property, properties, page }: { template: GalleryTemplate; property?: BaitlyTemplateProperty; properties?: BaitlyTemplateProperty[]; page?: { html: string; css: string } }) {
  const srcDoc = useMemo(() => {
    const materialized = page ? null : materializeBaitlyJourneyTemplate(template,property,true,properties);
    const source = page ?? materialized!.pages.find((page)=>page.type === 'HOME') ?? materialized!.pages[0];
    const home = addBaitlyTemplateLogos(source.html, source.css);
    // Host thumbnails may use authenticated photos; persisted public pages keep their public URLs.
    let document = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${home?.css ?? ''}html{scrollbar-width:none}body{pointer-events:none}</style></head><body>${home?.html ?? ''}</body></html>`;
    for (const photo of (properties?.length ? properties : property ? [property] : []).flatMap((item) => [...(item.photoUrls ?? []), item.coverPhotoUrl]).filter((url): url is string => Boolean(url))) {
      const match = photo.match(/\/api\/properties\/(\d+)\/photos\/(\d+)\/data/);
      if (match) document = document.replaceAll(`${API_CONFIG.BASE_URL}/api/public/property-photos/${match[1]}/${match[2]}`, `${API_CONFIG.BASE_URL}/api/properties/${match[1]}/photos/${match[2]}/data`);
    }
    return document;
  },[template,property,properties,page]);
  // Keep scripts/forms disabled, while allowing same-site authenticated property photos to load.
  return <span className="baitly-template-snapshot" aria-hidden="true"><iframe title={template.name} srcDoc={srcDoc} sandbox="allow-same-origin" loading="lazy" tabIndex={-1} referrerPolicy="no-referrer" /></span>;
}
