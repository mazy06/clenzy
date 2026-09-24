import type { SiteLanguage } from '../siteLanguage';
import { BAITLY_MIGRATION_MESSAGES } from './baitlyMigration';

/**
 * Textes propres aux pages secondaires de la landing.
 *
 * <p>Un dictionnaire par langue plutot que des cles plates : ces pages sont
 * de la copie commerciale, elle se relit en bloc. Les listes structurees
 * (modules, solutions, ressources, tarifs) vivent dans leurs propres
 * fichiers.</p>
 */
const fr = {
  solutions: {
    eyebrow: 'Solutions',
    title: 'Le même moteur. Votre façon de travailler.',
    intro:
      'Conciergerie, hôte indépendant, riad ou portefeuille multi-propriétaires : Baitly s’adapte au périmètre, aux rôles et à la réglementation de chacun.',
    cta: 'En parler avec nous',
  },
  resources: {
    eyebrow: 'Ressources',
    title: 'La donnée et le savoir-faire, en accès libre.',
    intro:
      'Baromètre de marché, calculateurs, guides réglementaires : ce que nous apprenons en opérant Baitly, nous le partageons.',
  },
  migration: BAITLY_MIGRATION_MESSAGES.fr,
  compare: {
    eyebrow: 'Comparer',
    title: 'Comparez honnêtement. Choisissez sereinement.',
    intro:
      'Chaque outil a ses forces — nous les citons. Voici où Baitly est structurellement différent, et pour qui.',
    columns: {
      capability: 'Capacité',
      baitly: 'Baitly',
      intl: 'PMS internationaux',
      local: 'Outils locaux',
    },
    footnote:
      '« PMS internationaux » : Guesty, Hostaway, Lodgify, Smoobu… · « Outils locaux » : logiciels nationaux et gestion via extranets + Excel.',
    matrixTitle: 'Les comparatifs détaillés',
    matrixCopy: 'Pages en cours de rédaction — chacune avec ses concessions honnêtes.',
    soon: 'Bientôt',
    closingTitle: 'Le plus simple : voyez-le tourner.',
    closingCopy:
      '30 minutes sur vos propres logements valent mieux que tous les tableaux comparatifs.',
    cta: 'Réserver une démo',
    matrix: [
      'Agents IA avec validation humaine (HITL)',
      'Déclaration des voyageurs + taxe de séjour locale',
      'Encaissement en monnaie locale (SAR, MAD, EUR)',
      'Yield automatique borné + market data',
      'Booking engine + galerie de templates',
      'Tarifs publics',
      'Import self-service depuis votre ancien outil',
    ],
    competitors: [
      { name: 'Baitly vs Superhote', copy: 'Le leader français des conciergeries — sans agents IA HITL ni conformité locale.' },
      { name: 'Baitly vs Guesty', copy: 'L’enterprise américain — puissant, mais au prix et à la complexité d’un enterprise.' },
      { name: 'Baitly vs Hostaway', copy: '« AI PMS » revendiqué, pricing opaque, pas d’ancrage local.' },
      { name: 'Baitly vs Lodgify', copy: 'Fort sur le site direct, léger sur les opérations terrain.' },
      { name: 'Baitly vs les outils nationaux', copy: 'La conformité, oui — mais ni agents IA, ni booking engine, ni yield.' },
      { name: 'Baitly vs Excel + WhatsApp', copy: 'Votre organisation actuelle, sans les nuits blanches.' },
    ],
  },
  demo: {
    eyebrow: 'Démo',
    title: 'Voyez Baitly tourner. En vrai.',
    intro:
      'Une démo guidée par un humain qui connaît le métier — pas un webinaire enregistré.',
    expectations: [
      '30 minutes, sur vos propres logements si vous le souhaitez',
      'En arabe, en français ou en anglais',
      'Vos questions de conformité traitées en direct',
      'Aucun engagement — et pas de relance harcelante',
    ],
    hurry: 'Pressé ?',
    whatsapp: 'Écrivez-nous sur WhatsApp',
    fields: {
      name: 'Votre nom',
      namePlaceholder: 'Salma Bennani',
      phone: 'Téléphone / WhatsApp',
      email: 'Email',
      size: 'Nombre de logements',
      tool: 'Outil actuel',
    },
    sizes: { s1: '1 à 4', s2: '5 à 20', s3: '21 à 50', s4: 'Plus de 50' },
    tools: { none: 'Extranets + Excel', other: 'Autre' },
    submit: 'Réserver ma démo',
    legal: 'Réponse sous 24 h ouvrées. Vos données restent chez Baitly.',
  },
  status: {
    eyebrow: 'Statut du service',
    title: 'Tous les systèmes sont opérationnels.',
    intro:
      'Disponibilité visée : 99,5 % par mois (engagement des CGV, art. 9). Cette page publie l’état de chaque composant et l’historique des incidents, sans maquillage.',
    operational: 'Opérationnel',
    targetLabel: 'disponibilité visée, par mois',
    measurementTitle: 'Mesure publique',
    measurementCopy:
      'Les taux de disponibilité mesurés seront publiés ici dès que la sonde publique sera en place. Nous préférons cette page vide à des chiffres que vous ne pourriez pas vérifier.',
    incidentsTitle: 'Historique des incidents',
    noIncidents: 'Aucun incident publié à ce jour.',
    subscribe:
      'Abonnez-vous aux notifications d’incident par email depuis Paramètres → Notifications, ou suivez cette page. Les fenêtres de maintenance sont annoncées au moins 48 h à l’avance.',
    components: [
      'Application PMS (app.baitly)',
      'API & webhooks',
      'Booking engine & sites',
      'Synchronisation des canaux (ARI)',
      'Paiements (PayTabs · CMI / PayZone · YouCan Pay · Stripe)',
      'Messagerie (email · WhatsApp)',
      'Agents IA',
    ],
  },
};

export type PageMessages = typeof fr;

const en: PageMessages = {
  solutions: {
    eyebrow: 'Solutions',
    title: 'The same engine. Your way of working.',
    intro:
      'Property manager, independent host, guesthouse or multi-owner portfolio: Baitly adapts to each one’s scope, roles and regulations.',
    cta: 'Talk it through with us',
  },
  resources: {
    eyebrow: 'Resources',
    title: 'The data and the know-how, openly.',
    intro:
      'Market barometer, calculators, regulatory guides: what we learn running Baitly, we share.',
  },
  migration: BAITLY_MIGRATION_MESSAGES.en,
  compare: {
    eyebrow: 'Compare',
    title: 'Compare honestly. Choose calmly.',
    intro:
      'Every tool has its strengths — we name them. Here is where Baitly is structurally different, and for whom.',
    columns: {
      capability: 'Capability',
      baitly: 'Baitly',
      intl: 'International PMS',
      local: 'Local tools',
    },
    footnote:
      '“International PMS”: Guesty, Hostaway, Lodgify, Smoobu… · “Local tools”: national software and managing through extranets + Excel.',
    matrixTitle: 'The detailed comparisons',
    matrixCopy: 'Pages being written — each with its honest concessions.',
    soon: 'Soon',
    closingTitle: 'Simplest of all: watch it run.',
    closingCopy: 'Thirty minutes on your own properties beats every comparison table.',
    cta: 'Book a demo',
    matrix: [
      'AI agents with human approval',
      'Guest registration + local tourist tax',
      'Collection in local currency (SAR, MAD, EUR)',
      'Bounded automatic yield + market data',
      'Booking engine + template gallery',
      'Public pricing',
      'Self-service import from your old tool',
    ],
    competitors: [
      { name: 'Baitly vs Superhote', copy: 'The French property-manager leader — without approval-gated AI agents or local compliance.' },
      { name: 'Baitly vs Guesty', copy: 'The American enterprise — powerful, at enterprise price and complexity.' },
      { name: 'Baitly vs Hostaway', copy: 'A claimed “AI PMS”, opaque pricing, no local footing.' },
      { name: 'Baitly vs Lodgify', copy: 'Strong on the direct site, light on field operations.' },
      { name: 'Baitly vs national tools', copy: 'Compliance, yes — but no AI agents, no booking engine, no yield.' },
      { name: 'Baitly vs Excel + WhatsApp', copy: 'Your current setup, without the sleepless nights.' },
    ],
  },
  demo: {
    eyebrow: 'Demo',
    title: 'See Baitly run. For real.',
    intro: 'A demo guided by a human who knows the trade — not a recorded webinar.',
    expectations: [
      'Thirty minutes, on your own properties if you like',
      'In Arabic, French or English',
      'Your compliance questions answered live',
      'No commitment — and no pestering follow-ups',
    ],
    hurry: 'In a hurry?',
    whatsapp: 'Message us on WhatsApp',
    fields: {
      name: 'Your name',
      namePlaceholder: 'Salma Bennani',
      phone: 'Phone / WhatsApp',
      email: 'Email',
      size: 'Number of properties',
      tool: 'Current tool',
    },
    sizes: { s1: '1 to 4', s2: '5 to 20', s3: '21 to 50', s4: 'More than 50' },
    tools: { none: 'Extranets + Excel', other: 'Other' },
    submit: 'Book my demo',
    legal: 'Answer within one working day. Your data stays with Baitly.',
  },
  status: {
    eyebrow: 'Service status',
    title: 'All systems operational.',
    intro:
      'Availability target: 99.5% per month (terms of sale, art. 9). This page publishes each component’s state and the incident history, unvarnished.',
    operational: 'Operational',
    targetLabel: 'availability target, per month',
    measurementTitle: 'Public measurement',
    measurementCopy:
      'Measured availability will be published here as soon as the public probe is in place. We prefer this page empty to figures you could not verify.',
    incidentsTitle: 'Incident history',
    noIncidents: 'No incident published to date.',
    subscribe:
      'Subscribe to incident notifications by email from Settings → Notifications, or follow this page. Maintenance windows are announced at least 48 hours ahead.',
    components: [
      'PMS application (app.baitly)',
      'API & webhooks',
      'Booking engine & websites',
      'Channel synchronisation (ARI)',
      'Payments (PayTabs · CMI / PayZone · YouCan Pay · Stripe)',
      'Messaging (email · WhatsApp)',
      'AI agents',
    ],
  },
};

const ar: PageMessages = {
  solutions: {
    eyebrow: 'الحلول',
    title: 'المحرّك نفسه. وطريقتك في العمل.',
    intro:
      'شركة إدارة، أو مضيف مستقل، أو دار ضيافة، أو محفظة متعددة الملّاك: يتكيّف بايتلي مع نطاق كلٍّ منها وأدوارها وأنظمتها.',
    cta: 'تحدّث إلينا',
  },
  resources: {
    eyebrow: 'الموارد',
    title: 'البيانات والخبرة، متاحة للجميع.',
    intro:
      'مؤشر السوق، والحاسبات، والأدلة التنظيمية: ما نتعلّمه من تشغيل بايتلي نشاركه معكم.',
  },
  migration: BAITLY_MIGRATION_MESSAGES.ar,
  compare: {
    eyebrow: 'المقارنة',
    title: 'قارن بنزاهة. واختر باطمئنان.',
    intro:
      'لكل أداة نقاط قوّتها — ونحن نذكرها. وهنا يختلف بايتلي اختلافاً بنيوياً، ولمن.',
    columns: {
      capability: 'القدرة',
      baitly: 'بايتلي',
      intl: 'الأنظمة العالمية',
      local: 'الأدوات المحلية',
    },
    footnote:
      '«الأنظمة العالمية»: Guesty، Hostaway، Lodgify، Smoobu… · «الأدوات المحلية»: البرامج الوطنية والإدارة عبر لوحات المنصّات وإكسل.',
    matrixTitle: 'المقارنات التفصيلية',
    matrixCopy: 'صفحات قيد الكتابة — كلٌّ منها بتنازلاتها المعلنة بصراحة.',
    soon: 'قريباً',
    closingTitle: 'الأبسط: شاهده يعمل.',
    closingCopy: 'ثلاثون دقيقة على وحداتك أنت تغني عن كل جداول المقارنة.',
    cta: 'احجز عرضاً توضيحياً',
    matrix: [
      'وكلاء ذكاء اصطناعي بمصادقة بشرية',
      'تسجيل النزلاء ورسم الإقامة المحلي',
      'التحصيل بالعملة المحلية (ريال، درهم، يورو)',
      'تسعير آلي بحدود مع بيانات السوق',
      'محرك حجز مع معرض قوالب',
      'أسعار معلنة',
      'استيراد ذاتي من أداتك السابقة',
    ],
    competitors: [
      { name: 'بايتلي مقابل Superhote', copy: 'رائد شركات الإدارة الفرنسي — بلا وكلاء بمصادقة بشرية ولا امتثال محلي.' },
      { name: 'بايتلي مقابل Guesty', copy: 'النظام المؤسسي الأمريكي — قويّ، لكن بسعر وتعقيد المؤسسات.' },
      { name: 'بايتلي مقابل Hostaway', copy: '«نظام بالذكاء الاصطناعي» بالادعاء، وتسعير غامض، وبلا جذور محلية.' },
      { name: 'بايتلي مقابل Lodgify', copy: 'قويّ في الموقع المباشر، خفيف في العمليات الميدانية.' },
      { name: 'بايتلي مقابل الأدوات الوطنية', copy: 'الامتثال نعم — لكن بلا وكلاء ولا محرك حجز ولا تسعير.' },
      { name: 'بايتلي مقابل إكسل وواتساب', copy: 'تنظيمك الحالي، دون الليالي البيضاء.' },
    ],
  },
  demo: {
    eyebrow: 'عرض توضيحي',
    title: 'شاهد بايتلي يعمل. على الحقيقة.',
    intro: 'عرض يقوده إنسان يعرف المهنة — لا ندوة مسجّلة.',
    expectations: [
      'ثلاثون دقيقة، على وحداتك أنت إن رغبت',
      'بالعربية أو الفرنسية أو الإنجليزية',
      'أسئلة الامتثال لديك تُجاب مباشرةً',
      'بلا أي التزام — وبلا متابعة مزعجة',
    ],
    hurry: 'على عجل؟',
    whatsapp: 'راسلنا على واتساب',
    fields: {
      name: 'اسمك',
      namePlaceholder: 'سلمى بناني',
      phone: 'الهاتف / واتساب',
      email: 'البريد الإلكتروني',
      size: 'عدد الوحدات',
      tool: 'الأداة الحالية',
    },
    sizes: { s1: 'من 1 إلى 4', s2: 'من 5 إلى 20', s3: 'من 21 إلى 50', s4: 'أكثر من 50' },
    tools: { none: 'لوحات المنصّات وإكسل', other: 'أخرى' },
    submit: 'احجز عرضي',
    legal: 'الرد خلال يوم عمل واحد. تبقى بياناتك لدى بايتلي.',
  },
  status: {
    eyebrow: 'حالة الخدمة',
    title: 'جميع الأنظمة تعمل.',
    intro:
      'نسبة التوافر المستهدفة: 99,5 % شهرياً (التزام الشروط العامة، المادة 9). تنشر هذه الصفحة حالة كل مكوّن وسجلّ الأعطال، دون تجميل.',
    operational: 'يعمل',
    targetLabel: 'التوافر المستهدف شهرياً',
    measurementTitle: 'القياس المعلَن',
    measurementCopy:
      'ستُنشر نسب التوافر المقيسة هنا فور تشغيل المسبار المعلَن. نفضّل صفحة فارغة على أرقام لا يمكنك التحقق منها.',
    incidentsTitle: 'سجلّ الأعطال',
    noIncidents: 'لم يُنشر أي عطل حتى الآن.',
    subscribe:
      'اشترك في إشعارات الأعطال بالبريد من الإعدادات ← الإشعارات، أو تابع هذه الصفحة. يُعلن عن نوافذ الصيانة قبل 48 ساعة على الأقل.',
    components: [
      'تطبيق إدارة العقارات (app.baitly)',
      'الواجهة البرمجية والويب هوك',
      'محرك الحجز والمواقع',
      'مزامنة القنوات (ARI)',
      'المدفوعات (PayTabs · CMI / PayZone · YouCan Pay · Stripe)',
      'المراسلة (البريد · واتساب)',
      'وكلاء الذكاء الاصطناعي',
    ],
  },
};

export const PAGE_MESSAGES: Record<SiteLanguage, PageMessages> = { fr, en, ar };
