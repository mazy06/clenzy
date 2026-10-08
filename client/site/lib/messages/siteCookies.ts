import type { SiteLanguage } from '../siteLanguage';

const fr = {
  manage: 'Gérer les cookies',
  assistant: 'Assistant Baitly',
  title: 'Votre navigation, votre choix',
  description: 'Baitly utilise uniquement les cookies et stockages nécessaires à votre navigation, à votre langue et aux services que vous demandez. Aucun traceur publicitaire ou de mesure d’audience n’est activé sur ce site.',
  scope: 'Votre choix concerne ce site vitrine, sur ce navigateur. Il ne désactive pas les cookies nécessaires à votre connexion au PMS.',
  note: 'Accepter ou refuser laisse aujourd’hui uniquement les cookies nécessaires. Tout ajout de traceurs facultatifs fera l’objet d’un nouveau choix.',
  accept: 'Accepter',
  refuse: 'Refuser',
  close: 'Fermer sans accepter',
  details: 'Quels cookies sont utilisés ?',
  necessary: 'Nécessaires uniquement',
  duration: 'Choix conservé 6 mois. Modifiable à tout moment en pied de page.',
  policy: 'Lire la politique des cookies',
  saved: 'Votre choix a été enregistré.',
  unavailable: 'Votre navigateur ne permet pas de mémoriser ce choix. Il reste appliqué sur cette page ; aucun traceur facultatif n’est activé.',
  accepted: 'Votre choix actuel : accepter les usages décrits.',
  refused: 'Votre choix actuel : refuser les cookies facultatifs.',
  inventory: [
    ['Choix cookies', 'Mémorise votre décision pendant 6 mois, sans identifiant de suivi.'],
    ['Langue', 'Retient la langue choisie pendant la session de cet onglet.'],
    ['Services demandés', 'La candidature prestataire et la connexion au PMS utilisent leurs propres cookies de session sécurisés.'],
  ],
};
type Messages = typeof fr;
const en: Messages = {
  manage: 'Manage cookies', assistant: 'Baitly assistant', title: 'Your browsing, your choice',
  description: 'Baitly only uses cookies and storage needed for browsing, your language and the services you request. No advertising or audience measurement tracker is enabled on this site.',
  scope: 'Your choice applies to this public website in this browser. It does not disable the cookies required to sign in to the PMS.',
  note: 'Accepting or refusing currently leaves only necessary cookies. Any new optional trackers will require a new choice.',
  accept: 'Accept', refuse: 'Refuse', close: 'Close without accepting', details: 'Which cookies are used?',
  necessary: 'Necessary only', duration: 'Choice kept for 6 months. Change it any time in the footer.',
  policy: 'Read the cookie policy', saved: 'Your choice has been saved.',
  unavailable: 'Your browser cannot save this choice. It still applies on this page; no optional tracker is enabled.',
  accepted: 'Your current choice: accept the described uses.', refused: 'Your current choice: refuse optional cookies.',
  inventory: [
    ['Cookie choice', 'Remembers your decision for 6 months without a tracking identifier.'],
    ['Language', 'Remembers your selected language for this tab’s session.'],
    ['Requested services', 'Provider applications and PMS sign-in use their own secure session cookies.'],
  ],
};
const ar: Messages = {
  manage: 'إدارة ملفات تعريف الارتباط', assistant: 'مساعد Baitly', title: 'تصفحك، اختيارك',
  description: 'يستخدم Baitly فقط ملفات تعريف الارتباط والتخزين اللازمة للتصفح ولغتك والخدمات التي تطلبها. لا توجد أدوات تتبع للإعلانات أو لقياس الجمهور مفعّلة على هذا الموقع.',
  scope: 'ينطبق اختيارك على هذا الموقع التعريفي في هذا المتصفح. ولا يعطّل الملفات الضرورية لتسجيل الدخول إلى نظام إدارة العقارات.',
  note: 'القبول أو الرفض يُبقي حالياً الملفات الضرورية فقط. وستتطلب إضافة أي أدوات تتبع اختيارية اختياراً جديداً.',
  accept: 'قبول', refuse: 'رفض', close: 'إغلاق دون قبول', details: 'ما الملفات المستخدمة؟',
  necessary: 'الضرورية فقط', duration: 'يُحفظ الاختيار لمدة 6 أشهر. يمكنك تعديله في أي وقت من تذييل الصفحة.',
  policy: 'قراءة سياسة ملفات تعريف الارتباط', saved: 'تم حفظ اختيارك.',
  unavailable: 'لا يسمح متصفحك بحفظ هذا الاختيار. يظل مطبّقاً في هذه الصفحة؛ ولا تُفعّل أي أدوات تتبع اختيارية.',
  accepted: 'اختيارك الحالي: قبول الاستخدامات الموضحة.', refused: 'اختيارك الحالي: رفض الملفات الاختيارية.',
  inventory: [
    ['اختيار الملفات', 'يحفظ قرارك لمدة 6 أشهر دون معرّف تتبع.'],
    ['اللغة', 'يحفظ اللغة المختارة طوال جلسة علامة التبويب.'],
    ['الخدمات المطلوبة', 'تستخدم طلبات مقدمي الخدمات وتسجيل الدخول ملفات الجلسة الآمنة الخاصة بها.'],
  ],
};
export const SITE_COOKIES_MESSAGES: Record<SiteLanguage, Messages> = { fr, en, ar };
