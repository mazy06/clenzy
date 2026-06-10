/**
 * Libellés de la page publique de signature du contrat de gestion (/sign/:token).
 *
 * Pattern guideLabels.ts : objet TypeScript pur, sans i18next — la page publique
 * est indépendante du contexte de l'app authentifiée. Langue détectée via
 * navigator.language (fr par défaut).
 */

export type SignLang = 'fr' | 'en' | 'ar';

export interface SignLabels {
  brandTagline: string;
  title: string;
  subtitle: string;
  // Résumé contrat
  summaryTitle: string;
  property: string;
  owner: string;
  contractType: string;
  commission: string;
  period: string;
  periodOpenEnded: string;
  collection: string;
  // Document
  documentTitle: string;
  documentHint: string;
  documentUnavailable: string;
  download: string;
  // Signature
  signTitle: string;
  signerNameLabel: string;
  signerNamePlaceholder: string;
  signButton: string;
  signing: string;
  // États
  loadingText: string;
  notFoundTitle: string;
  notFoundText: string;
  expiredTitle: string;
  expiredText: string;
  cancelledTitle: string;
  cancelledText: string;
  signedTitle: string;
  signedText: string;
  successTitle: string;
  successText: string;
  errorTitle: string;
  errorText: string;
  signError: string;
  footer: string;
  contractTypes: Record<string, string>;
  paymentModels: Record<string, string>;
}

export const SIGN_LABELS: Record<SignLang, SignLabels> = {
  fr: {
    brandTagline: 'Signature électronique',
    title: 'Mandat de gestion',
    subtitle: 'Consultez le document ci-dessous, puis signez-le électroniquement pour le rendre effectif.',
    summaryTitle: 'Récapitulatif du contrat',
    property: 'Logement',
    owner: 'Propriétaire',
    contractType: 'Type de contrat',
    commission: 'Commission',
    period: 'Période',
    periodOpenEnded: 'jusqu’à résiliation',
    collection: 'Encaissement',
    documentTitle: 'Document',
    documentHint: 'Lisez attentivement le mandat avant de signer.',
    documentUnavailable: 'Le document n’est pas disponible pour le moment. Contactez votre gestionnaire.',
    download: 'Télécharger le PDF',
    signTitle: 'Signature',
    signerNameLabel: 'Votre nom complet',
    signerNamePlaceholder: 'ex : Jean Dupont',
    signButton: 'Signer le contrat',
    signing: 'Signature en cours…',
    loadingText: 'Chargement du contrat…',
    notFoundTitle: 'Lien indisponible',
    notFoundText: 'Ce lien de signature n’existe pas ou n’est plus accessible.',
    expiredTitle: 'Lien expiré',
    expiredText: 'Ce lien de signature a expiré. Demandez à votre gestionnaire de vous en renvoyer un nouveau.',
    cancelledTitle: 'Lien annulé',
    cancelledText: 'Ce lien n’est plus valide — le contrat a été modifié ou traité autrement. Un nouveau lien a pu vous être envoyé.',
    signedTitle: 'Contrat signé',
    signedText: 'Ce contrat a été signé le {date} par {name}. Vous pouvez télécharger l’exemplaire signé ci-dessous.',
    successTitle: 'Merci, votre contrat est signé !',
    successText: 'Votre mandat de gestion est maintenant actif. Un exemplaire signé (avec certificat de signature) est téléchargeable ci-dessous.',
    errorTitle: 'Une erreur est survenue',
    errorText: 'Impossible de charger le contrat. Réessayez plus tard.',
    signError: 'La signature a échoué. Vérifiez les champs et réessayez.',
    footer: 'Signature électronique simple — règlement (UE) n°910/2014 (eIDAS), art. 25.',
    contractTypes: {
      FULL_MANAGEMENT: 'Gestion complète',
      BOOKING_ONLY: 'Réservations uniquement',
      MAINTENANCE_ONLY: 'Maintenance uniquement',
      CUSTOM: 'Personnalisé',
    },
    paymentModels: {
      DIRECT: 'Direct — la plateforme encaisse',
      OWNER_COLLECTS: 'OTA — le propriétaire encaisse',
      CONCIERGE_COLLECTS: 'OTA — la conciergerie encaisse',
      OTA_COHOST_SPLIT: 'OTA — co-hosting (répartition à la source)',
    },
  },
  en: {
    brandTagline: 'Electronic signature',
    title: 'Management mandate',
    subtitle: 'Review the document below, then sign it electronically to make it effective.',
    summaryTitle: 'Contract summary',
    property: 'Property',
    owner: 'Owner',
    contractType: 'Contract type',
    commission: 'Commission',
    period: 'Period',
    periodOpenEnded: 'until terminated',
    collection: 'Payment collection',
    documentTitle: 'Document',
    documentHint: 'Please read the mandate carefully before signing.',
    documentUnavailable: 'The document is not available right now. Please contact your manager.',
    download: 'Download PDF',
    signTitle: 'Signature',
    signerNameLabel: 'Your full name',
    signerNamePlaceholder: 'e.g. John Smith',
    signButton: 'Sign the contract',
    signing: 'Signing…',
    loadingText: 'Loading the contract…',
    notFoundTitle: 'Link unavailable',
    notFoundText: 'This signing link does not exist or is no longer accessible.',
    expiredTitle: 'Link expired',
    expiredText: 'This signing link has expired. Ask your manager to send you a new one.',
    cancelledTitle: 'Link cancelled',
    cancelledText: 'This link is no longer valid — the contract was modified or handled otherwise. A new link may have been sent to you.',
    signedTitle: 'Contract signed',
    signedText: 'This contract was signed on {date} by {name}. You can download the signed copy below.',
    successTitle: 'Thank you, your contract is signed!',
    successText: 'Your management mandate is now active. A signed copy (with signature certificate) can be downloaded below.',
    errorTitle: 'Something went wrong',
    errorText: 'Unable to load the contract. Please try again later.',
    signError: 'Signing failed. Check the fields and try again.',
    footer: 'Simple electronic signature — EU Regulation No 910/2014 (eIDAS), art. 25.',
    contractTypes: {
      FULL_MANAGEMENT: 'Full management',
      BOOKING_ONLY: 'Bookings only',
      MAINTENANCE_ONLY: 'Maintenance only',
      CUSTOM: 'Custom',
    },
    paymentModels: {
      DIRECT: 'Direct — the platform collects',
      OWNER_COLLECTS: 'OTA — the owner collects',
      CONCIERGE_COLLECTS: 'OTA — the concierge collects',
      OTA_COHOST_SPLIT: 'OTA — co-hosting (split at source)',
    },
  },
  ar: {
    brandTagline: 'التوقيع الإلكتروني',
    title: 'عقد الإدارة',
    subtitle: 'راجع المستند أدناه ثم وقّعه إلكترونيًا ليصبح ساريًا.',
    summaryTitle: 'ملخص العقد',
    property: 'العقار',
    owner: 'المالك',
    contractType: 'نوع العقد',
    commission: 'العمولة',
    period: 'المدة',
    periodOpenEnded: 'حتى الفسخ',
    collection: 'التحصيل',
    documentTitle: 'المستند',
    documentHint: 'يرجى قراءة العقد بعناية قبل التوقيع.',
    documentUnavailable: 'المستند غير متاح حاليًا. يرجى التواصل مع مديرك.',
    download: 'تحميل PDF',
    signTitle: 'التوقيع',
    signerNameLabel: 'اسمك الكامل',
    signerNamePlaceholder: 'مثال: أحمد محمد',
    signButton: 'توقيع العقد',
    signing: 'جارٍ التوقيع…',
    loadingText: 'جارٍ تحميل العقد…',
    notFoundTitle: 'الرابط غير متاح',
    notFoundText: 'رابط التوقيع هذا غير موجود أو لم يعد متاحًا.',
    expiredTitle: 'انتهت صلاحية الرابط',
    expiredText: 'انتهت صلاحية رابط التوقيع. اطلب من مديرك إرسال رابط جديد.',
    cancelledTitle: 'الرابط ملغى',
    cancelledText: 'هذا الرابط لم يعد صالحًا — تم تعديل العقد أو معالجته بطريقة أخرى. ربما أُرسل إليك رابط جديد.',
    signedTitle: 'تم توقيع العقد',
    signedText: 'تم توقيع هذا العقد في {date} بواسطة {name}. يمكنك تحميل النسخة الموقعة أدناه.',
    successTitle: 'شكرًا، تم توقيع عقدك!',
    successText: 'عقد الإدارة الخاص بك أصبح ساريًا الآن. يمكنك تحميل النسخة الموقعة (مع شهادة التوقيع) أدناه.',
    errorTitle: 'حدث خطأ',
    errorText: 'تعذر تحميل العقد. حاول مرة أخرى لاحقًا.',
    signError: 'فشل التوقيع. تحقق من الحقول وأعد المحاولة.',
    footer: 'توقيع إلكتروني بسيط — لائحة الاتحاد الأوروبي رقم 910/2014 (eIDAS)، المادة 25.',
    contractTypes: {
      FULL_MANAGEMENT: 'إدارة كاملة',
      BOOKING_ONLY: 'الحجوزات فقط',
      MAINTENANCE_ONLY: 'الصيانة فقط',
      CUSTOM: 'مخصص',
    },
    paymentModels: {
      DIRECT: 'مباشر — المنصة تُحصّل',
      OWNER_COLLECTS: 'OTA — المالك يُحصّل',
      CONCIERGE_COLLECTS: 'OTA — الكونسيرج يُحصّل',
      OTA_COHOST_SPLIT: 'OTA — استضافة مشتركة (تقسيم عند المصدر)',
    },
  },
};

export function detectSignLang(): SignLang {
  const lang = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  if (lang === 'en') return 'en';
  if (lang === 'ar') return 'ar';
  return 'fr';
}
