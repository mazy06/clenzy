import type { GalleryTemplate } from './galleryTemplates';

/** Provenance only: content lives in the client's own SitePages, never in the shared master. */
export function templateForkMetadata(template: Pick<GalleryTemplate, 'id' | 'journeyId' | 'version'>) {
  return {
    baitlyTemplateId: template.id,
    baitlyJourneyId: template.journeyId,
    baitlyTemplateFork: { sourceId: template.id, sourceVersion: template.version ?? 'legacy', mode: 'independent' },
  };
}
