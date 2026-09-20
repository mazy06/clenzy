import type { SiteLanguage } from '../siteLanguage';

/**
 * Habillage de la page produit : demos animees, section marketplace,
 * segmentation par taille.
 *
 * <p>Le texte propre a chaque module (titre, arguments, FAQ) vit dans
 * `modules.ts` ; ici ne restent que les elements que toutes les pages
 * produit partagent, plus les legendes des demos animees, indexees par
 * slug de module.</p>
 */
export interface ModuleDemoText {
  title: string;
  copy: string;
  points: readonly string[];
}

const fr = {
  ctaDemo: 'Réserver une démo',
  ctaPricing: 'Voir les tarifs',
  faqTitle: 'Questions fréquentes',
  segmentsTitle: 'Pensé pour votre taille de portefeuille',
  segments: [
    { range: '1–5 logements', copy: 'Configuration guidée, automatisations simples, validation mobile.' },
    { range: '5–50 logements', copy: 'Équipes, portail propriétaires, règles par segment de biens.' },
    { range: '50+ logements', copy: 'Multi-organisations, permissions fines, journal d’audit exportable.' },
  ],
  marketplace: {
    eyebrow: 'Écosystème de partenaires',
    title: 'Une marketplace connectée aux leaders de l’expérience.',
    introBefore: 'Deux sources de revenu depuis le même livret : une ',
    introAffiliation: 'commission d’affiliation',
    introMiddle: ' sur les partenaires externes, et vos ',
    introOwn: 'propres prestations',
    introAfter: ', vendues à la marge que vous fixez.',
    commissionRange: '8 – 20 %',
    commissionLabel: 'de commission par réservation, selon le partenaire',
    guestsTitle: 'Ce que réservent vos voyageurs',
    guestsItems: ['Activités & excursions', 'Billetterie musées', 'Transferts privés', 'Livraison de repas', 'Courses & épicerie'],
    guestsFooter: 'Commission d’affiliation',
    guestsFooterNote: '— vous n’opérez rien',
    ownTitle: 'Ce que vous vendez vous-même',
    ownItems: ['Départ tardif', 'Arrivée anticipée', 'Panier d’arrivée', 'Transfert aéroport', 'Ménage en cours de séjour', 'Location de vélos', 'Garde-bagages', 'Petit-déjeuner livré'],
    ownFooter: 'Votre prix, votre marge',
    ownFooterNote: '— aucune commission prélevée',
    note: 'Chaque partenaire est activable et configurable (commission, mise en avant, catalogue).',
  },
  demos: {
    'pms-channel-manager': {
      title: 'Un planning qui refuse la double réservation.',
      copy: 'L’écran Planning réel : toutes vos annonces sur une seule grille, quel que soit le canal. Déplacez un séjour, étirez-le, bloquez des nuits — le ménage suit, et un chevauchement est refusé avant d’exister.',
      points: ['Protection anti-surbooking en direct', 'Le ménage se replanifie au nouveau départ', 'Filtre par canal en un clic'],
    },
    'objets-connectes': {
      title: 'Regardez-le fonctionner. Pour de vrai.',
      copy: 'Ce n’est pas une image : c’est l’écran Objets connectés de l’application, piloté sous vos yeux — capteur de bruit, verrouillage à distance, mur de vidéosurveillance.',
      points: ['Seuils jour/nuit par logement', 'Codes bornés au séjour', 'Extérieurs uniquement — vie privée respectée'],
    },
    'portail-proprietaire': {
      title: 'Ce que voit votre propriétaire.',
      copy: 'L’espace mandant réel de l’application : net à verser, occupation, revenus sur 12 mois, et les relevés mensuels qu’il télécharge en un clic — tenus à jour automatiquement.',
      points: ['Relevés mensuels téléchargeables', 'Versements et commission détaillés', 'Aucune ressaisie de votre côté'],
    },
    'operations-menage': {
      title: 'Vos interventions, filtrées en un geste.',
      copy: 'L’écran Interventions réel de l’application : chaque départ génère sa mission, filtrez par ménage, maintenance ou check-in — assignation, checklist et preuve photo suivent.',
      points: ['Missions générées au checkout', 'Filtres par type et statut', 'Payout gaté sur preuve photo'],
    },
  } as Record<string, ModuleDemoText>,
};

export type ModulePageMessages = typeof fr;

const en: ModulePageMessages = {
  ctaDemo: 'Book a demo',
  ctaPricing: 'See pricing',
  faqTitle: 'Frequently asked questions',
  segmentsTitle: 'Built for the size of your portfolio',
  segments: [
    { range: '1–5 properties', copy: 'Guided setup, simple automations, approval from your phone.' },
    { range: '5–50 properties', copy: 'Teams, owner portal, rules per property segment.' },
    { range: '50+ properties', copy: 'Multi-organisation, fine-grained permissions, exportable audit log.' },
  ],
  marketplace: {
    eyebrow: 'Partner ecosystem',
    title: 'A marketplace connected to the leaders in experiences.',
    introBefore: 'Two revenue streams from the same guest guide: an ',
    introAffiliation: 'affiliate commission',
    introMiddle: ' on external partners, and your ',
    introOwn: 'own services',
    introAfter: ', sold at the margin you set.',
    commissionRange: '8 – 20%',
    commissionLabel: 'commission per booking, depending on the partner',
    guestsTitle: 'What your guests book',
    guestsItems: ['Activities & excursions', 'Museum tickets', 'Private transfers', 'Meal delivery', 'Groceries'],
    guestsFooter: 'Affiliate commission',
    guestsFooterNote: '— you operate nothing',
    ownTitle: 'What you sell yourself',
    ownItems: ['Late checkout', 'Early check-in', 'Welcome basket', 'Airport transfer', 'Mid-stay cleaning', 'Bike rental', 'Luggage storage', 'Breakfast delivered'],
    ownFooter: 'Your price, your margin',
    ownFooterNote: '— no commission taken',
    note: 'Every partner can be switched on and configured (commission, promotion, catalogue).',
  },
  demos: {
    'pms-channel-manager': {
      title: 'A calendar that refuses double bookings.',
      copy: 'The real Calendar screen: every listing on a single grid, whatever the channel. Move a stay, stretch it, block nights — housekeeping follows, and an overlap is refused before it exists.',
      points: ['Live overbooking protection', 'Housekeeping reschedules to the new checkout', 'Filter by channel in one click'],
    },
    'objets-connectes': {
      title: 'Watch it work. For real.',
      copy: 'This is not a picture: it is the app’s Connected devices screen, driven in front of you — noise sensor, remote locking, video wall.',
      points: ['Day/night thresholds per property', 'Codes bound to the stay', 'Outdoors only — privacy respected'],
    },
    'portail-proprietaire': {
      title: 'What your owner sees.',
      copy: 'The app’s real owner space: net payout, occupancy, twelve months of revenue, and the monthly statements they download in one click — kept current automatically.',
      points: ['Downloadable monthly statements', 'Payouts and commission itemised', 'No re-keying on your side'],
    },
    'operations-menage': {
      title: 'Your jobs, filtered in one gesture.',
      copy: 'The app’s real Jobs screen: every checkout generates its mission, filter by cleaning, maintenance or check-in — assignment, checklist and photo proof follow.',
      points: ['Missions generated at checkout', 'Filters by type and status', 'Payout gated on photo proof'],
    },
  },
};

const ar: ModulePageMessages = {
  ctaDemo: 'احجز عرضاً توضيحياً',
  ctaPricing: 'اطّلع على الأسعار',
  faqTitle: 'أسئلة متكرّرة',
  segmentsTitle: 'مصمَّم على قياس محفظتك',
  segments: [
    { range: 'من 1 إلى 5 وحدات', copy: 'إعداد موجَّه، وأتمتة بسيطة، ومصادقة من الهاتف.' },
    { range: 'من 5 إلى 50 وحدة', copy: 'فرق عمل، وبوابة ملّاك، وقواعد حسب فئة العقارات.' },
    { range: 'أكثر من 50 وحدة', copy: 'تعدّد المنشآت، وصلاحيات دقيقة، وسجل تدقيق قابل للتصدير.' },
  ],
  marketplace: {
    eyebrow: 'منظومة الشركاء',
    title: 'سوق متصل بروّاد تجارب الضيافة.',
    introBefore: 'مصدرا دخل من الدليل نفسه: ',
    introAffiliation: 'عمولة إحالة',
    introMiddle: ' على الشركاء الخارجيين، و',
    introOwn: 'خدماتك أنت',
    introAfter: ' تبيعها بالهامش الذي تحدّده.',
    commissionRange: '8 – 20 %',
    commissionLabel: 'عمولة لكل حجز، بحسب الشريك',
    guestsTitle: 'ما يحجزه نزلاؤك',
    guestsItems: ['أنشطة ورحلات', 'تذاكر المتاحف', 'توصيل خاص', 'توصيل وجبات', 'تسوّق ومواد غذائية'],
    guestsFooter: 'عمولة إحالة',
    guestsFooterNote: '— دون أن تشغّل شيئاً',
    ownTitle: 'ما تبيعه أنت',
    ownItems: ['مغادرة متأخرة', 'وصول مبكر', 'سلّة ترحيب', 'توصيل من المطار', 'تنظيف أثناء الإقامة', 'تأجير درّاجات', 'حفظ الأمتعة', 'فطور يُوصَّل'],
    ownFooter: 'سعرك وهامشك',
    ownFooterNote: '— دون أي عمولة',
    note: 'كل شريك قابل للتفعيل والضبط (العمولة، والإبراز، والكتالوج).',
  },
  demos: {
    'pms-channel-manager': {
      title: 'تقويم يرفض الحجز المزدوج.',
      copy: 'شاشة التقويم الحقيقية: كل إعلاناتك على شبكة واحدة، أياً كانت القناة. حرّك إقامةً أو مدّدها أو احجب ليالي — يتبع التنظيف، ويُرفض التداخل قبل أن يقع.',
      points: ['حماية فورية من الحجز الزائد', 'التنظيف يُعاد جدولته على المغادرة الجديدة', 'ترشيح حسب القناة بنقرة'],
    },
    'objets-connectes': {
      title: 'شاهده يعمل. على الحقيقة.',
      copy: 'ليست صورة: إنها شاشة الأجهزة المتصلة في التطبيق، تُدار أمامك — حسّاس الضجيج، والإقفال عن بُعد، وجدار المراقبة.',
      points: ['عتبات نهارية وليلية لكل وحدة', 'رموز محدودة بمدّة الإقامة', 'الخارج فقط — الخصوصية محفوظة'],
    },
    'portail-proprietaire': {
      title: 'ما يراه مالكك.',
      copy: 'فضاء المالك الحقيقي في التطبيق: الصافي المستحق، والإشغال، وإيرادات اثني عشر شهراً، والكشوف الشهرية بنقرة واحدة — محدَّثة تلقائياً.',
      points: ['كشوف شهرية قابلة للتحميل', 'تفصيل التحويلات والعمولة', 'دون أي إعادة إدخال من طرفك'],
    },
    'operations-menage': {
      title: 'مهامك، مفلترة بحركة واحدة.',
      copy: 'شاشة المهام الحقيقية في التطبيق: كل مغادرة تولّد مهمتها، رشّح حسب التنظيف أو الصيانة أو الاستقبال — ويتبع الإسناد وقائمة التحقق والإثبات المصوّر.',
      points: ['مهام تُولَّد عند المغادرة', 'ترشيح حسب النوع والحالة', 'الدفع مشروط بالإثبات المصوّر'],
    },
  },
};

export const MODULE_PAGE_MESSAGES: Record<SiteLanguage, ModulePageMessages> = { fr, en, ar };
