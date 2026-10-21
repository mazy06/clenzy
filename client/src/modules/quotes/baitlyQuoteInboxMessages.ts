// Ces libellés accompagnent le module pour les sessions ayant une locale déjà en cache.
const messages = {
  fr: {
    all: 'Tous les devis', filterStatus: 'Statut des devis', allRequests: 'Toutes les demandes', filterRequests: 'Statut des demandes',
    title: 'Devis', help: 'Tous vos devis et demandes, avec le même accord que dans les discussions.', openDocument: 'Ouvrir le PDF',
    closed: 'Écartés et expirés', reference: (id: number | null) => `Devis #${id ?? ''}`,
    provider: 'Prestataire', property: 'Logement', created: 'Date du devis', validUntil: 'Valable jusqu’au',
    originalAmount: 'Montant initial', document: 'Document du devis', noDocument: 'Aucun PDF enregistré pour ce devis.',
    notSpecified: 'Non renseigné', discussion: 'Discussion', service: 'Voir la prestation', links: 'Liens associés', expired: 'Expiré',
    status: { RECEIVED: 'À décider', APPROVED: 'Approuvé', REJECTED: 'Écarté', EXPIRED: 'Expiré' },
  },
  en: {
    all: 'All quotes', filterStatus: 'Quote status', allRequests: 'All requests', filterRequests: 'Request status',
    title: 'Quotes', help: 'All your quotes and requests, with the same agreement as in conversations.', openDocument: 'Open PDF',
    closed: 'Declined and expired', reference: (id: number | null) => `Quote #${id ?? ''}`,
    provider: 'Provider', property: 'Property', created: 'Quote date', validUntil: 'Valid until',
    originalAmount: 'Original amount', document: 'Quote document', noDocument: 'No PDF saved for this quote.',
    notSpecified: 'Not specified', discussion: 'Conversation', service: 'View service', links: 'Related links', expired: 'Expired',
    status: { RECEIVED: 'To decide', APPROVED: 'Approved', REJECTED: 'Declined', EXPIRED: 'Expired' },
  },
  ar: {
    all: 'جميع العروض', filterStatus: 'حالة عروض الأسعار', allRequests: 'جميع الطلبات', filterRequests: 'حالة الطلبات',
    title: 'عروض الأسعار', help: 'جميع عروض الأسعار والطلبات، بنفس الاتفاق الظاهر في المحادثات.', openDocument: 'فتح ملف PDF',
    closed: 'المرفوضة والمنتهية', reference: (id: number | null) => `عرض سعر #${id ?? ''}`,
    provider: 'مقدم الخدمة', property: 'العقار', created: 'تاريخ العرض', validUntil: 'صالح حتى',
    originalAmount: 'المبلغ الأصلي', document: 'مستند عرض السعر', noDocument: 'لا يوجد ملف PDF محفوظ لهذا العرض.',
    notSpecified: 'غير محدد', discussion: 'المحادثة', service: 'عرض الخدمة', links: 'الروابط المرتبطة', expired: 'منتهي الصلاحية',
    status: { RECEIVED: 'بانتظار القرار', APPROVED: 'مقبول', REJECTED: 'مرفوض', EXPIRED: 'منتهي الصلاحية' },
  },
};

export function quoteInboxMessages(language = 'fr') {
  return messages[language.startsWith('ar') ? 'ar' : language.startsWith('en') ? 'en' : 'fr'];
}
