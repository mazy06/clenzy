const copy = {
  fr: {
    title: 'Préparer un rapport', subtitle: 'Choisissez le destinataire, le périmètre et les rubriques à partager.',
    audience: 'Destinataire', scope: 'Période et périmètre', content: 'Rubriques du rapport', required: 'Rubrique obligatoire',
    preview: 'Aperçu', calculating: 'Calcul en cours…', generating: 'Génération en cours…',
    generate: (count: number) => `Générer ${count} document${count > 1 ? 's' : ''}`,
    library: 'Bibliothèque de rapports', libraryHint: 'Retrouvez vos brouillons et les documents transmis.',
    send: 'Envoyer', remove: 'Supprimer', confirmRemove: 'Confirmer la suppression', retry: 'Réessayer',
    loadFailed: 'Les documents n’ont pas pu être chargés.', consolidated: 'Portefeuille consolidé',
  },
  en: {
    title: 'Prepare a report', subtitle: 'Choose the recipient, scope and sections to share.',
    audience: 'Recipient', scope: 'Period and scope', content: 'Report sections', required: 'Required section',
    preview: 'Preview', calculating: 'Calculating…', generating: 'Generating…',
    generate: (count: number) => `Generate ${count} document${count > 1 ? 's' : ''}`,
    library: 'Report library', libraryHint: 'Find your drafts and delivered documents.',
    send: 'Send', remove: 'Delete', confirmRemove: 'Confirm deletion', retry: 'Try again',
    loadFailed: 'The documents could not be loaded.', consolidated: 'Consolidated portfolio',
  },
  ar: {
    title: 'إعداد تقرير', subtitle: 'اختر المستلم والنطاق والأقسام التي تريد مشاركتها.',
    audience: 'المستلم', scope: 'الفترة والنطاق', content: 'أقسام التقرير', required: 'قسم إلزامي',
    preview: 'معاينة', calculating: 'جارٍ الحساب…', generating: 'جارٍ الإنشاء…',
    generate: (count: number) => `إنشاء ${count} مستند`,
    library: 'مكتبة التقارير', libraryHint: 'اعثر على المسودات والمستندات المرسلة.',
    send: 'إرسال', remove: 'حذف', confirmRemove: 'تأكيد الحذف', retry: 'إعادة المحاولة',
    loadFailed: 'تعذر تحميل المستندات.', consolidated: 'المحفظة المجمعة',
  },
};
export function composerCopy(language = 'fr') { return copy[language.startsWith('ar') ? 'ar' : language.startsWith('en') ? 'en' : 'fr']; }
