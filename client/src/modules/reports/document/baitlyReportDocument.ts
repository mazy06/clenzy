/** Named roles shared by the report reader and the print template's palette. */
export function reportSectionTone(id: string): 'activity' | 'money' | 'operations' | 'neutral' {
  if (['pnl', 'settlement', 'upsells', 'expenses'].includes(id)) return 'money';
  if (['operations', 'reputation', 'nuisances', 'decisions'].includes(id)) return 'operations';
  if (['performance', 'occupancy', 'cancellations', 'distribution', 'leadtime', 'seasonality', 'pricing', 'outlook'].includes(id)) return 'activity';
  return 'neutral';
}

const labels = {
  fr: { summary: 'Synthèse', chapter: 'Chapitre', recipient: 'Établi pour', scope: 'Périmètre', property: 'bien', properties: 'biens', currency: 'Devise', reference: 'Référence', version: 'version', asOf: 'Données arrêtées au', previous: 'période préc.', lastYear: 'an dernier', owner: 'Relevé de gestion', internal: 'Revue de performance', prospect: 'Dossier de performance' },
  en: { summary: 'Summary', chapter: 'Chapter', recipient: 'Prepared for', scope: 'Scope', property: 'property', properties: 'properties', currency: 'Currency', reference: 'Reference', version: 'version', asOf: 'Data as of', previous: 'previous period', lastYear: 'last year', owner: 'Management report', internal: 'Performance review', prospect: 'Performance dossier' },
  ar: { summary: 'ملخص', chapter: 'الفصل', recipient: 'أُعدّ لـ', scope: 'النطاق', property: 'عقار', properties: 'عقارات', currency: 'العملة', reference: 'المرجع', version: 'الإصدار', asOf: 'البيانات حتى', previous: 'الفترة السابقة', lastYear: 'العام الماضي', owner: 'تقرير الإدارة', internal: 'مراجعة الأداء', prospect: 'ملف الأداء' },
};
export function reportDocumentCopy(language = 'fr') {
  return labels[language.startsWith('ar') ? 'ar' : language.startsWith('en') ? 'en' : 'fr'];
}
