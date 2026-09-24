import type { SiteLanguage } from '../siteLanguage';
import type { ProductStoryKind } from '../../data/baitlyProductStories';

interface ProductStory {
  title: [string, string];
  intro: string;
  promises: [string, string, string];
  featuresTitle: string;
  featuresIntro: string;
  imageCaption: string;
  workflowTitle: string;
  steps: { title: string; copy: string }[];
  finalTitle: string;
}

interface ProductStoriesMessages {
  demo: string;
  example: string;
  tryIt: string;
  explore: string;
  cta: string;
  pricing: string;
  faq: string;
  ecosystem: string;
  otherModules: string;
  migration: string;
  finalCopy: string;
  appPreview: string;
  appLanguage: string;
  detail: string;
  pages: Record<ProductStoryKind, ProductStory>;
}

const fr: ProductStoriesMessages = {
  demo: 'Démo interactive',
  example: 'Données fictives. Vos essais ne déclenchent aucune action réelle.',
  tryIt: 'À vous d’essayer',
  explore: 'Explorer les fonctionnalités',
  cta: 'Découvrir Baitly',
  pricing: 'Voir les offres',
  faq: 'Vos questions, simplement.',
  ecosystem: 'Dans votre écosystème',
  otherModules: 'La suite de votre quotidien',
  migration: 'Préparer ma migration',
  finalCopy:
    'Retrouvez ces outils dans un même espace, avec une offre adaptée à votre nombre de logements.',
  appPreview: 'Explorer aussi l’écran de l’application',
  appLanguage:
    'Un aperçu de l’application avec des données de démonstration.',
  detail: 'Découvrir',
  pages: {
    agents: {
      title: ['Une équipe en coulisses.', 'Vous, aux commandes.'],
      intro:
        'Les agents Baitly repèrent ce qui mérite votre attention, préparent les actions et expliquent leurs propositions. Vous décidez de la suite.',
      promises: [
        'Validation humaine par défaut',
        'Un rôle clair pour chaque agent',
        'Un historique des décisions',
      ],
      featuresTitle:
        'Moins de tâches en attente. Plus de présence pour vos voyageurs.',
      featuresIntro:
        'Prix, messages, opérations et supervision : une aide concrète à chaque moment du séjour.',
      imageCaption: 'Votre accueil garde toute sa place.',
      workflowTitle: 'De la proposition à l’action, vous gardez le fil.',
      steps: [
        {
          title: 'L’agent repère',
          copy: 'Une date à ajuster, un message à préparer, une mission à organiser.',
        },
        {
          title: 'Vous arbitrez',
          copy: 'Lisez la proposition, ses raisons et ses limites avant de valider.',
        },
        {
          title: 'Baitly suit',
          copy: 'Retrouvez l’action et votre décision dans le journal d’activité.',
        },
      ],
      finalTitle: 'Faites de la place à ce qui compte.',
    },
    revenue: {
      title: ['Chaque nuit compte.', 'Chaque tarif s’explique.'],
      intro:
        'Lisez votre marché, repérez les dates à travailler et ajustez vos prix dans les limites que vous fixez. Vos décisions deviennent plus lisibles.',
      promises: [
        'Un prix plancher respecté',
        'Des ajustements expliqués',
        'Une vue sur votre marché',
      ],
      featuresTitle: 'Du marché à votre calendrier.',
      featuresIntro:
        'Les données vous donnent le contexte. Vos règles donnent le cadre.',
      imageCaption: 'Le bon contexte pour valoriser chaque nuit.',
      workflowTitle: 'Un tarif construit, pas un chiffre au hasard.',
      steps: [
        {
          title: 'Observer',
          copy: 'Occupation, saisonnalité et rythme des réservations éclairent les dates à travailler.',
        },
        {
          title: 'Encadrer',
          copy: 'Définissez vos prix de base, vos saisons et vos limites de variation.',
        },
        {
          title: 'Ajuster',
          copy: 'Examinez les propositions et suivez leur application dans le calendrier.',
        },
      ],
      finalTitle: 'Gardez le cap sur vos revenus.',
    },
    finance: {
      title: ['Du séjour au versement.', 'Gardez les comptes clairs.'],
      intro:
        'Encaissements, factures et versements réunis. Suivez le parcours de chaque paiement avec les moyens adaptés à votre marché.',
      promises: [
        'Des moyens de paiement locaux',
        'Des factures liées aux séjours',
        'Des versements détaillés',
      ],
      featuresTitle: 'Chaque montant a son histoire.',
      featuresIntro:
        'Reliez la réservation, son règlement et les sommes à reverser sans multiplier les tableaux.',
      imageCaption: 'L’expérience du séjour, jusqu’au règlement.',
      workflowTitle: 'Un parcours financier facile à suivre.',
      steps: [
        {
          title: 'Encaisser',
          copy: 'Proposez un moyen de paiement disponible pour votre pays et votre compte.',
        },
        {
          title: 'Rapprocher',
          copy: 'Retrouvez le paiement, sa réservation et les documents associés.',
        },
        {
          title: 'Reverser',
          copy: 'Détaillez les commissions et les montants destinés aux propriétaires et prestataires.',
        },
      ],
      finalTitle: 'Vos opérations financières, au même endroit.',
    },
    operations: {
      title: ['Entre deux séjours,', 'tout se prépare.'],
      intro:
        'Une équipe informée, des consignes au bon endroit et des preuves visibles. Organisez les ménages et les interventions jusqu’à la validation.',
      promises: [
        'Des missions liées aux séjours',
        'Des consignes par logement',
        'Des preuves avant validation',
      ],
      featuresTitle: 'Le détail fait la différence à l’arrivée.',
      featuresIntro:
        'Du départ du voyageur au logement prêt, chacun sait ce qu’il doit faire.',
      imageCaption: 'Les bons gestes, dans chaque logement.',
      workflowTitle: 'Une mission ne s’arrête pas à son assignation.',
      steps: [
        {
          title: 'Planifier',
          copy: 'Organisez le créneau entre deux séjours et affectez la bonne équipe.',
        },
        {
          title: 'Documenter',
          copy: 'Retrouvez les consignes, complétez la checklist et ajoutez les preuves photo.',
        },
        {
          title: 'Valider',
          copy: 'Contrôlez le travail avant de poursuivre le circuit de paiement.',
        },
      ],
      finalTitle: 'Préparez chaque arrivée avec votre équipe.',
    },
    devices: {
      title: ['Vous êtes ailleurs.', 'Tout reste à portée.'],
      intro:
        'Accès au logement, état des équipements et alertes utiles : suivez l’essentiel à distance, avec des règles liées au séjour.',
      promises: [
        'Des accès limités au séjour',
        'Des alertes configurables',
        'Le respect de la vie privée',
      ],
      featuresTitle: 'Un logement connecté à votre organisation.',
      featuresIntro:
        'Les équipements vous remontent les informations utiles pour agir au bon moment.',
      imageCaption: 'L’arrivée se prépare avant le premier pas.',
      workflowTitle: 'Le bon accès, au bon moment.',
      steps: [
        {
          title: 'Avant l’arrivée',
          copy: 'Préparez l’accès et les consignes associés à la réservation.',
        },
        {
          title: 'Pendant le séjour',
          copy: 'Suivez les équipements et recevez les alertes que vous avez configurées.',
        },
        {
          title: 'Après le départ',
          copy: 'Le créneau d’accès se termine. Vous gardez une trace des événements.',
        },
      ],
      finalTitle: 'Restez proche, même à distance.',
    },
    owners: {
      title: ['Des comptes lisibles.', 'Une relation sereine.'],
      intro:
        'Offrez à chaque propriétaire un espace pour suivre son logement, comprendre ses revenus et retrouver ses documents.',
      promises: [
        'Un espace par propriétaire',
        'Des relevés détaillés',
        'Des mandats signés en ligne',
      ],
      featuresTitle: 'La transparence devient un service.',
      featuresIntro:
        'Les informations sont accessibles. Vos échanges peuvent se concentrer sur les décisions.',
      imageCaption: 'Un propriétaire informé, un partenariat suivi.',
      workflowTitle: 'De l’accord initial au relevé mensuel.',
      steps: [
        {
          title: 'Formaliser',
          copy: 'Préparez le mandat, le modèle d’encaissement et les droits d’accès.',
        },
        {
          title: 'Partager',
          copy: 'Le propriétaire retrouve les informations de ses biens dans son espace.',
        },
        {
          title: 'Rendre compte',
          copy: 'Revenus, commissions et dépenses composent un relevé facile à relire.',
        },
      ],
      finalTitle: 'Donnez de la visibilité à vos mandants.',
    },
  },
};

const en: ProductStoriesMessages = {
  demo: 'Interactive demo',
  example: 'Fictional data. Your experiments trigger no real actions.',
  tryIt: 'Try it yourself',
  explore: 'Explore the features',
  cta: 'Discover Baitly',
  pricing: 'See the plans',
  faq: 'Your questions, answered.',
  ecosystem: 'In your ecosystem',
  otherModules: 'The next part of your day',
  migration: 'Plan my migration',
  finalCopy:
    'Find these tools in one workspace, with a plan suited to your property portfolio.',
  appPreview: 'Explore the application screen too',
  appLanguage: 'An application preview with demo data.',
  detail: 'Discover',
  pages: {
    agents: {
      title: ['A team behind the scenes.', 'You stay in control.'],
      intro:
        'Baitly agents spot what needs attention, prepare actions and explain their proposals. You decide what happens next.',
      promises: [
        'Human approval by default',
        'A clear role for each agent',
        'A record of decisions',
      ],
      featuresTitle: 'Fewer tasks waiting. More time for your guests.',
      featuresIntro:
        'Pricing, messages, operations and supervision: practical help throughout the stay.',
      imageCaption: 'Keep hospitality at the heart of your work.',
      workflowTitle: 'From proposal to action, stay in the loop.',
      steps: [
        {
          title: 'The agent spots',
          copy: 'A price to adjust, a message to prepare, a job to organise.',
        },
        {
          title: 'You decide',
          copy: 'Review the proposal, its reasoning and its limits before approving.',
        },
        {
          title: 'Baitly tracks',
          copy: 'Find the action and your decision in the activity log.',
        },
      ],
      finalTitle: 'Make room for what matters.',
    },
    revenue: {
      title: ['Every night matters.', 'Every price has a reason.'],
      intro:
        'Read your market, identify dates to work on and adjust prices within your limits. Make clearer pricing decisions.',
      promises: [
        'Your price floor respected',
        'Explained adjustments',
        'A view of your market',
      ],
      featuresTitle: 'From the market to your calendar.',
      featuresIntro: 'Data gives you context. Your rules set the boundaries.',
      imageCaption: 'The context to price each night thoughtfully.',
      workflowTitle: 'A price with a reason behind it.',
      steps: [
        {
          title: 'Observe',
          copy: 'Occupancy, seasonality and booking pace help identify dates to work on.',
        },
        {
          title: 'Set boundaries',
          copy: 'Define base prices, seasons and adjustment limits.',
        },
        {
          title: 'Adjust',
          copy: 'Review proposals and follow their application in the calendar.',
        },
      ],
      finalTitle: 'Keep your revenue in focus.',
    },
    finance: {
      title: ['From stay to payout.', 'Keep the numbers clear.'],
      intro:
        'Payments, invoices and payouts together. Follow each payment with methods suited to your market.',
      promises: [
        'Local payment methods',
        'Invoices linked to stays',
        'Itemised payouts',
      ],
      featuresTitle: 'Every amount has a story.',
      featuresIntro:
        'Connect the booking, its payment and the funds to distribute without multiplying spreadsheets.',
      imageCaption: 'A complete stay, through to payment.',
      workflowTitle: 'A financial journey you can follow.',
      steps: [
        {
          title: 'Collect',
          copy: 'Offer a payment method available for your country and account.',
        },
        {
          title: 'Reconcile',
          copy: 'Find the payment, its booking and associated documents.',
        },
        {
          title: 'Distribute',
          copy: 'Itemise commissions and amounts due to owners and providers.',
        },
      ],
      finalTitle: 'Your financial operations, together.',
    },
    operations: {
      title: ['Between two stays,', 'get everything ready.'],
      intro:
        'An informed team, instructions in the right place and visible evidence. Organise cleaning and maintenance through to approval.',
      promises: [
        'Jobs linked to stays',
        'Instructions per property',
        'Evidence before approval',
      ],
      featuresTitle: 'The details make the welcome.',
      featuresIntro:
        'From checkout to a ready property, everyone knows what to do.',
      imageCaption: 'The right care, in every property.',
      workflowTitle: 'A job goes beyond its assignment.',
      steps: [
        {
          title: 'Plan',
          copy: 'Organise the time between stays and assign the right team.',
        },
        {
          title: 'Document',
          copy: 'Read instructions, complete the checklist and add photo evidence.',
        },
        {
          title: 'Approve',
          copy: 'Check the work before continuing the payment process.',
        },
      ],
      finalTitle: 'Prepare every arrival with your team.',
    },
    devices: {
      title: ['You are elsewhere.', 'Everything is in reach.'],
      intro:
        'Property access, equipment status and useful alerts: follow the essentials remotely, with rules tied to the stay.',
      promises: [
        'Access limited to the stay',
        'Configurable alerts',
        'Privacy respected',
      ],
      featuresTitle: 'A property connected to your workflow.',
      featuresIntro:
        'Your equipment surfaces the information you need to act at the right time.',
      imageCaption: 'Arrival starts before the first step inside.',
      workflowTitle: 'The right access at the right time.',
      steps: [
        {
          title: 'Before arrival',
          copy: 'Prepare access and instructions linked to the booking.',
        },
        {
          title: 'During the stay',
          copy: 'Follow equipment status and receive your configured alerts.',
        },
        {
          title: 'After checkout',
          copy: 'The access window ends. Keep a record of events.',
        },
      ],
      finalTitle: 'Stay close, even from a distance.',
    },
    owners: {
      title: ['Clear statements.', 'A confident partnership.'],
      intro:
        'Give each owner a space to follow their property, understand their income and find their documents.',
      promises: [
        'A workspace for each owner',
        'Detailed statements',
        'Management agreements signed online',
      ],
      featuresTitle: 'Transparency becomes a service.',
      featuresIntro:
        'Information is accessible. Your conversations can focus on decisions.',
      imageCaption: 'An informed owner, an ongoing partnership.',
      workflowTitle: 'From the first agreement to the monthly statement.',
      steps: [
        {
          title: 'Formalise',
          copy: 'Prepare the agreement, collection model and access rights.',
        },
        {
          title: 'Share',
          copy: 'Owners find information about their properties in their own space.',
        },
        {
          title: 'Report',
          copy: 'Revenue, commissions and expenses make a statement that is easy to review.',
        },
      ],
      finalTitle: 'Give your owners a clearer view.',
    },
  },
};

const ar: ProductStoriesMessages = {
  demo: 'عرض تفاعلي',
  example: 'بيانات افتراضية. تجاربك لا تُطلق أي إجراء حقيقي.',
  tryIt: 'جرّب بنفسك',
  explore: 'اكتشف الميزات',
  cta: 'اكتشف بايتلي',
  pricing: 'اطّلع على العروض',
  faq: 'أسئلتك، بإجابات واضحة.',
  ecosystem: 'ضمن منظومتك',
  otherModules: 'الخطوة التالية في يومك',
  migration: 'حضّر انتقالي',
  finalCopy: 'كل هذه الأدوات في مساحة واحدة، مع عرض يناسب عدد وحداتك.',
  appPreview: 'استكشف أيضاً شاشة التطبيق',
  appLanguage: 'معاينة التطبيق مع بيانات تجريبية.',
  detail: 'اكتشف',
  pages: {
    agents: {
      title: ['فريق يعمل في الخلفية.', 'والقرار يبقى لك.'],
      intro:
        'يرصد وكلاء بايتلي ما يستحق انتباهك ويحضّرون الإجراءات ويشرحون مقترحاتهم. أنت تقرّر الخطوة التالية.',
      promises: ['موافقة بشرية افتراضياً', 'دور واضح لكل وكيل', 'سجل للقرارات'],
      featuresTitle: 'مهام معلّقة أقل. حضور أكبر لنزلائك.',
      featuresIntro:
        'الأسعار والرسائل والعمليات والإشراف: مساعدة عملية طوال الإقامة.',
      imageCaption: 'تبقى الضيافة في صميم عملك.',
      workflowTitle: 'من الاقتراح إلى التنفيذ، تتابع كل خطوة.',
      steps: [
        {
          title: 'الوكيل يرصد',
          copy: 'سعراً يحتاج تعديلاً أو رسالة للتحضير أو مهمة للتنظيم.',
        },
        {
          title: 'أنت تقرّر',
          copy: 'راجع الاقتراح وأسبابه وحدوده قبل الموافقة.',
        },
        {
          title: 'بايتلي يتابع',
          copy: 'اعثر على الإجراء وقرارك في سجل النشاط.',
        },
      ],
      finalTitle: 'أفسح المجال لما يهمّك.',
    },
    revenue: {
      title: ['كل ليلة لها قيمة.', 'وكل سعر له تفسير.'],
      intro:
        'اقرأ سوقك وحدّد التواريخ التي تستحق العمل وعدّل الأسعار ضمن حدودك. قراراتك تصبح أوضح.',
      promises: ['حدّك الأدنى محفوظ', 'تعديلات مشروحة', 'رؤية لسوقك'],
      featuresTitle: 'من السوق إلى تقويمك.',
      featuresIntro: 'البيانات تمنحك السياق. وقواعدك تحدّد الإطار.',
      imageCaption: 'السياق المناسب لتسعير كل ليلة.',
      workflowTitle: 'سعر مبني على أسباب واضحة.',
      steps: [
        {
          title: 'راقب',
          copy: 'الإشغال والموسمية ووتيرة الحجوزات توضّح التواريخ التي تحتاج انتباهاً.',
        },
        {
          title: 'حدّد الإطار',
          copy: 'اضبط الأسعار الأساسية والمواسم وحدود التغيير.',
        },
        { title: 'عدّل', copy: 'راجع المقترحات وتابع تطبيقها في التقويم.' },
      ],
      finalTitle: 'حافظ على وضوح إيراداتك.',
    },
    finance: {
      title: ['من الإقامة إلى التحويل.', 'حساباتك واضحة.'],
      intro:
        'المدفوعات والفواتير والتحويلات معاً. تابع كل دفعة بوسائل تناسب سوقك.',
      promises: [
        'وسائل دفع محلية',
        'فواتير مرتبطة بالإقامات',
        'تحويلات مفصّلة',
      ],
      featuresTitle: 'لكل مبلغ قصة.',
      featuresIntro: 'اربط الحجز بدفعته والمبالغ المستحقة دون مضاعفة الجداول.',
      imageCaption: 'تجربة إقامة متكاملة حتى الدفع.',
      workflowTitle: 'مسار مالي سهل المتابعة.',
      steps: [
        { title: 'حصّل', copy: 'قدّم وسيلة دفع متاحة لبلدك وحسابك.' },
        {
          title: 'طابق',
          copy: 'اعثر على الدفعة وحجزها والمستندات المرتبطة بها.',
        },
        {
          title: 'حوّل',
          copy: 'وضّح العمولات والمبالغ المستحقة للملّاك والمزوّدين.',
        },
      ],
      finalTitle: 'عملياتك المالية في مكان واحد.',
    },
    operations: {
      title: ['بين إقامتين،', 'كل شيء يستعدّ.'],
      intro:
        'فريق مطّلع وتعليمات في مكانها وإثبات واضح. نظّم التنظيف والصيانة حتى الموافقة.',
      promises: [
        'مهام مرتبطة بالإقامات',
        'تعليمات لكل وحدة',
        'إثبات قبل الموافقة',
      ],
      featuresTitle: 'التفاصيل تصنع الاستقبال.',
      featuresIntro: 'من المغادرة إلى جاهزية الوحدة، يعرف الجميع ما يجب فعله.',
      imageCaption: 'العناية المناسبة في كل وحدة.',
      workflowTitle: 'المهمة لا تنتهي عند إسنادها.',
      steps: [
        {
          title: 'خطّط',
          copy: 'نظّم الوقت بين الإقامات وأسند المهمة للفريق المناسب.',
        },
        {
          title: 'وثّق',
          copy: 'اقرأ التعليمات وأكمل قائمة التحقق وأضف الإثبات المصوّر.',
        },
        { title: 'وافق', copy: 'راجع العمل قبل متابعة مسار الدفع.' },
      ],
      finalTitle: 'حضّر كل وصول مع فريقك.',
    },
    devices: {
      title: ['أنت في مكان آخر.', 'وكل شيء في متناولك.'],
      intro:
        'دخول الوحدة وحالة الأجهزة وتنبيهات مفيدة: تابع الأساسيات عن بُعد بقواعد مرتبطة بالإقامة.',
      promises: [
        'دخول محدود بالإقامة',
        'تنبيهات قابلة للضبط',
        'احترام الخصوصية',
      ],
      featuresTitle: 'وحدة متصلة بتنظيمك.',
      featuresIntro: 'أجهزتك تعرض المعلومات المفيدة للتصرف في الوقت المناسب.',
      imageCaption: 'الاستقبال يبدأ قبل الخطوة الأولى.',
      workflowTitle: 'الدخول المناسب في الوقت المناسب.',
      steps: [
        {
          title: 'قبل الوصول',
          copy: 'حضّر الدخول والتعليمات المرتبطة بالحجز.',
        },
        {
          title: 'أثناء الإقامة',
          copy: 'تابع الأجهزة واستقبل التنبيهات التي ضبطتها.',
        },
        {
          title: 'بعد المغادرة',
          copy: 'تنتهي فترة الدخول. وتحتفظ بسجل الأحداث.',
        },
      ],
      finalTitle: 'ابقَ قريباً، حتى عن بُعد.',
    },
    owners: {
      title: ['كشوف واضحة.', 'وعلاقة مطمئنة.'],
      intro:
        'امنح كل مالك مساحة لمتابعة وحدته وفهم إيراداته والعثور على مستنداته.',
      promises: [
        'مساحة لكل مالك',
        'كشوف مفصّلة',
        'عقود إدارة تُوقّع إلكترونياً',
      ],
      featuresTitle: 'الشفافية تصبح خدمة.',
      featuresIntro: 'المعلومات متاحة. ويمكن لمحادثاتكم التركيز على القرارات.',
      imageCaption: 'مالك مطّلع وشراكة مستمرة.',
      workflowTitle: 'من الاتفاق الأول إلى الكشف الشهري.',
      steps: [
        {
          title: 'وثّق الاتفاق',
          copy: 'حضّر العقد ونموذج التحصيل وصلاحيات الوصول.',
        },
        { title: 'شارك', copy: 'يجد المالك معلومات وحداته في مساحته الخاصة.' },
        {
          title: 'قدّم الحساب',
          copy: 'الإيرادات والعمولات والمصروفات في كشف سهل المراجعة.',
        },
      ],
      finalTitle: 'امنح ملّاكك رؤية أوضح.',
    },
  },
};

export const BAITLY_PRODUCT_MESSAGES: Record<
  SiteLanguage,
  ProductStoriesMessages
> = { fr, en, ar };
