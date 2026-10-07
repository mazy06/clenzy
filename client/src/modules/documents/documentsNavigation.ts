export const DOCUMENT_VIEWS = {
  catalog: ['library', 'guide', 'variables'],
  'message-templates': ['email', 'whatsapp'],
  history: ['activity', 'amendments'],
  compliance: ['checks', 'templates'],
} as const;
export type DocumentsTab = keyof typeof DOCUMENT_VIEWS;
const aliases: Record<string, { tab: DocumentsTab; view: string }> = {
  'document-templates': { tab: 'catalog', view: 'library' },
  'whatsapp-templates': { tab: 'message-templates', view: 'whatsapp' },
  variables: { tab: 'catalog', view: 'variables' },
  amendments: { tab: 'history', view: 'amendments' },
};
/** Keep saved links and notification targets working after navigation consolidation. */
export function resolveDocumentsLocation(params: URLSearchParams): { tab: DocumentsTab; view: string } {
  const raw = params.get('tab') || 'catalog';
  if (Object.prototype.hasOwnProperty.call(aliases, raw)) return aliases[raw];
  const tab = Object.prototype.hasOwnProperty.call(DOCUMENT_VIEWS, raw) ? raw as DocumentsTab : 'catalog';
  const views: readonly string[] = DOCUMENT_VIEWS[tab];
  const view = params.get('view');
  return { tab, view: view && views.includes(view) ? view : views[0] };
}
