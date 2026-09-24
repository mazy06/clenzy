import type { SiteLanguage } from '../siteLanguage';

const fr = {
  eyebrow: 'Bienvenue chez Baitly',
  title: 'Changez de PMS.',
  titleAccent: 'Gardez votre histoire.',
  intro:
    'Vos logements, vos voyageurs, vos réservations. Retrouvez vos repères dans Baitly, avec un parcours de migration préparé à vos côtés.',
  cta: 'Préparer ma migration',
  explore: 'Découvrir le parcours',
  trust: [
    'Vos annonces restent les vôtres',
    'Une reprise vérifiée ensemble',
    'Un accompagnement humain',
  ],
  visual: {
    before: 'Vos outils aujourd’hui',
    after: 'Votre nouvel espace',
    spreadsheet: 'Vos fichiers',
    example: 'Aperçu illustratif de migration',
    ready: 'Vos repères, réunis.',
    property: 'Riad des Orangers',
    location: 'Marrakech · Exemple de logement',
    items: ['Logements organisés', 'Historique de séjours', 'Fiches voyageurs'],
    caption: 'D’un outil à l’autre, votre activité garde le fil.',
  },
  channelsTitle: 'Vous venez d’où ?',
  channelsIntro:
    'Choisissez votre point de départ. Il existe plusieurs chemins pour rejoindre Baitly.',
  sourceLabel: 'Votre outil actuel',
  sourceNote:
    'Le périmètre de reprise dépend des données disponibles dans votre export et des accès autorisés par votre outil.',
  preview: 'Exemple de correspondance',
  original: 'Dans votre source',
  destination: 'Dans Baitly',
  mapped: 'Champs rapprochés',
  fields: ['Logement', 'Date d’arrivée', 'Référence du séjour'],
  channels: [
    {
      name: 'Airbnb & Booking.com',
      title: 'Partez de vos réservations existantes.',
      copy: 'Récupérez les exports de vos extranets. Ils servent de point de départ pour retrouver votre historique dans Baitly.',
      tag: 'Depuis vos plateformes',
      format: 'CSV / XLS',
      file: 'reservations.csv',
      points: [
        'Exports de transactions et de réservations',
        'Rapprochement avec vos logements',
        'Connexion des canaux dans un second temps',
      ],
      columns: ['Listing', 'Check-in', 'Confirmation code'],
    },
    {
      name: 'Un autre PMS',
      title: 'Votre historique a encore de la valeur.',
      copy: 'Superhote, Smoobu, Guesty, Hostaway, Beds24, OwnerRez : préparez l’export de votre outil, puis vérifiez les données à reprendre.',
      tag: 'Depuis votre logiciel',
      format: 'Export PMS',
      file: 'historique_pms.csv',
      points: [
        'Sauvegarde avant la fin de l’abonnement',
        'Colonnes associées aux champs Baitly',
        'Contrôle des réservations et des doublons',
      ],
      columns: ['Property name', 'Arrival date', 'Booking ID'],
    },
    {
      name: 'Excel & fichiers',
      title: 'Votre tableur devient un vrai point de départ.',
      copy: 'Vous avez déjà organisé votre activité dans un fichier ? Le modèle Baitly et la correspondance des colonnes vous aident à structurer la reprise.',
      tag: 'Depuis votre organisation',
      format: 'Tableur',
      file: 'mes_reservations.xlsx',
      points: [
        'Un modèle pour organiser votre fichier',
        'Des colonnes que vous pouvez reconnaître',
        'Un contrôle des données avant la bascule',
      ],
      columns: ['Hébergement', 'Arrivée', 'N° réservation'],
    },
    {
      name: 'Connexion API',
      title: 'Un accès direct, quand votre outil le permet.',
      copy: 'Selon le connecteur disponible, la reprise peut passer par un accès API. Nous vérifions avec vous les autorisations et les données accessibles.',
      tag: 'Selon le connecteur',
      format: 'API',
      file: 'reservations.json',
      points: [
        'Compatibilité de votre outil à confirmer',
        'Accès et périmètre vérifiés ensemble',
        'Reprise des données disponibles via l’API',
      ],
      columns: ['property_name', 'arrival_date', 'reservation_id'],
    },
  ],
  stepsTitle: 'Une transition préparée. Étape par étape.',
  stepsIntro:
    'On prépare le nouvel espace avant de tourner la page de l’ancien.',
  steps: [
    {
      title: 'On prépare',
      copy: 'Identifiez vos sources et sauvegardez vos exports avant de résilier votre ancien outil.',
      tag: 'Vos données au départ',
    },
    {
      title: 'On reprend',
      copy: 'Rapprochez logements, séjours et voyageurs. Vérifiez l’historique et les doublons.',
      tag: 'Votre historique',
    },
    {
      title: 'On reconnecte',
      copy: 'Rattachez vos annonces existantes et contrôlez les réservations à venir sur vos canaux.',
      tag: 'Vos canaux',
    },
    {
      title: 'Vous prenez la main',
      copy: 'Vérifiez les calendriers, préparez la bascule et retrouvez votre quotidien dans Baitly.',
      tag: 'Votre nouvel espace',
    },
  ],
  dataTitle: 'Chaque donnée retrouve sa place.',
  dataIntro:
    'Ce qui arrive dans Baitly, ce qui reste sur vos plateformes : vous savez à quoi vous attendre.',
  data: [
    {
      title: 'Vos logements',
      copy: 'Les informations disponibles servent à reconstituer votre portefeuille.',
      status: 'Repris selon la source',
    },
    {
      title: 'Vos réservations & voyageurs',
      copy: 'Votre historique et vos fiches sont rapprochés pour repartir avec des repères utiles.',
      status: 'Importés et vérifiés',
    },
    {
      title: 'Vos avis & vos notes',
      copy: 'Ils restent attachés à vos annonces Airbnb et Booking.com. Vous reconnectez vos annonces existantes.',
      status: 'Restent sur vos annonces',
    },
  ],
  guaranteesTitle: 'Vous avancez avec un filet de sécurité.',
  guarantees: [
    'Pas d’automatisation déclenchée sur l’historique importé',
    'Vérification des correspondances avant la bascule',
    'Calendriers contrôlés pendant la transition',
  ],
  limitsTitle: 'Et vos anciens messages ?',
  limitsCopy:
    'Leur reprise dépend des possibilités d’export de chaque outil. Ne comptez pas sur un transfert intégral : conservez une copie des échanges importants avant de résilier.',
  supportTitle: 'Un changement d’outil. Pas un saut dans le vide.',
  supportCopy:
    'Parlons de votre organisation, de votre PMS actuel et de vos logements. Nous préparons avec vous le périmètre et les étapes de la migration.',
  supportLanguages: 'Français · Arabe · Darija',
  checklistTitle: 'Pour préparer notre échange',
  checklist: [
    'Le nom de votre outil actuel',
    'Le nombre de logements à reprendre',
    'Un exemple de vos exports disponibles',
  ],
  pricing: 'Découvrir les offres',
};

export type BaitlyMigrationMessages = typeof fr;

const en: BaitlyMigrationMessages = {
  eyebrow: 'Welcome to Baitly',
  title: 'Change your PMS.',
  titleAccent: 'Keep your story.',
  intro:
    'Your properties, your guests, your bookings. Find your bearings in Baitly, with a migration journey prepared alongside you.',
  cta: 'Plan my migration',
  explore: 'Explore the journey',
  trust: [
    'Your listings stay yours',
    'A transfer checked together',
    'Human support',
  ],
  visual: {
    before: 'Your tools today',
    after: 'Your new workspace',
    spreadsheet: 'Your files',
    example: 'Illustrative migration preview',
    ready: 'Your essentials, together.',
    property: 'Riad des Orangers',
    location: 'Marrakech · Example property',
    items: ['Organised properties', 'Stay history', 'Guest profiles'],
    caption: 'A new tool, with continuity for your business.',
  },
  channelsTitle: 'Where are you coming from?',
  channelsIntro:
    'Choose your starting point. There is more than one way to join Baitly.',
  sourceLabel: 'Your current tool',
  sourceNote:
    'What can be transferred depends on the data in your export and the access your tool allows.',
  preview: 'Example field mapping',
  original: 'In your source',
  destination: 'In Baitly',
  mapped: 'Matched fields',
  fields: ['Property', 'Arrival date', 'Booking reference'],
  channels: [
    {
      name: 'Airbnb & Booking.com',
      title: 'Start with the bookings you already have.',
      copy: 'Download exports from your extranets. They provide a starting point for bringing your history into Baitly.',
      tag: 'From your platforms',
      format: 'CSV / XLS',
      file: 'reservations.csv',
      points: [
        'Transaction and reservation exports',
        'Matching to your properties',
        'Channel connections as a separate step',
      ],
      columns: ['Listing', 'Check-in', 'Confirmation code'],
    },
    {
      name: 'Another PMS',
      title: 'Your history still has value.',
      copy: 'Superhote, Smoobu, Guesty, Hostaway, Beds24, OwnerRez: prepare your export, then check which data can be transferred.',
      tag: 'From your software',
      format: 'PMS export',
      file: 'pms_history.csv',
      points: [
        'Back up before your subscription ends',
        'Map columns to Baitly fields',
        'Check reservations and duplicates',
      ],
      columns: ['Property name', 'Arrival date', 'Booking ID'],
    },
    {
      name: 'Excel & files',
      title: 'Your spreadsheet is a useful starting point.',
      copy: 'Already running your business from a file? The Baitly template and column mapping help you organise the transfer.',
      tag: 'From your own setup',
      format: 'Spreadsheet',
      file: 'my_reservations.xlsx',
      points: [
        'A template to organise your file',
        'Columns you can recognise',
        'Data checks before switching',
      ],
      columns: ['Accommodation', 'Arrival', 'Booking number'],
    },
    {
      name: 'API connection',
      title: 'A direct connection, when your tool allows it.',
      copy: 'Where a connector is available, migration can use API access. We check permissions and accessible data with you.',
      tag: 'Depends on the connector',
      format: 'API',
      file: 'reservations.json',
      points: [
        'Confirm compatibility with your tool',
        'Check access and scope together',
        'Transfer data available through the API',
      ],
      columns: ['property_name', 'arrival_date', 'reservation_id'],
    },
  ],
  stepsTitle: 'A planned transition. Step by step.',
  stepsIntro: 'Prepare your new workspace before closing the old one.',
  steps: [
    {
      title: 'Prepare',
      copy: 'Identify your sources and save exports before cancelling your current tool.',
      tag: 'Your starting data',
    },
    {
      title: 'Transfer',
      copy: 'Match properties, stays and guests. Check your history and duplicates.',
      tag: 'Your history',
    },
    {
      title: 'Reconnect',
      copy: 'Link your existing listings and check upcoming bookings on your channels.',
      tag: 'Your channels',
    },
    {
      title: 'Take the lead',
      copy: 'Check calendars, prepare the switch and start your daily work in Baitly.',
      tag: 'Your new workspace',
    },
  ],
  dataTitle: 'A place for every piece of data.',
  dataIntro:
    'What moves into Baitly and what stays on your platforms: know what to expect.',
  data: [
    {
      title: 'Your properties',
      copy: 'Available information helps rebuild your property portfolio.',
      status: 'Transferred where available',
    },
    {
      title: 'Your bookings & guests',
      copy: 'Your history and profiles are matched so you start with useful context.',
      status: 'Imported and checked',
    },
    {
      title: 'Your reviews & ratings',
      copy: 'They stay attached to your Airbnb and Booking.com listings. Reconnect your existing listings.',
      status: 'Stay on your listings',
    },
  ],
  guaranteesTitle: 'Move forward with a safety net.',
  guarantees: [
    'No automations triggered by imported history',
    'Field matches checked before switching',
    'Calendars checked during the transition',
  ],
  limitsTitle: 'What about old messages?',
  limitsCopy:
    'Availability depends on each tool’s export options. Do not rely on a complete transfer: keep a copy of important conversations before cancelling.',
  supportTitle: 'A change of tools. A clear way forward.',
  supportCopy:
    'Tell us about your setup, your current PMS and your properties. We will prepare the migration scope and steps together.',
  supportLanguages: 'French · Arabic · Darija',
  checklistTitle: 'For our conversation, prepare',
  checklist: [
    'The name of your current tool',
    'The number of properties to transfer',
    'A sample of your available exports',
  ],
  pricing: 'Explore the plans',
};

const ar: BaitlyMigrationMessages = {
  eyebrow: 'مرحباً بك في بايتلي',
  title: 'غيّر نظام الإدارة.',
  titleAccent: 'واحتفظ بقصتك.',
  intro:
    'وحداتك ونزلاؤك وحجوزاتك. استعد تفاصيل عملك في بايتلي، مع مسار انتقال نُعدّه معك خطوة بخطوة.',
  cta: 'حضّر انتقالي',
  explore: 'اكتشف المسار',
  trust: ['إعلاناتك تبقى لك', 'نراجع البيانات معاً', 'مرافقة بشرية'],
  visual: {
    before: 'أدواتك اليوم',
    after: 'مساحتك الجديدة',
    spreadsheet: 'ملفاتك',
    example: 'معاينة توضيحية للانتقال',
    ready: 'تفاصيل عملك، في مكان واحد.',
    property: 'رياض البرتقال',
    location: 'مراكش · مثال لوحدة',
    items: ['وحدات منظّمة', 'سجل الإقامات', 'ملفات النزلاء'],
    caption: 'أداة جديدة، واستمرارية لنشاطك.',
  },
  channelsTitle: 'ما نقطة انطلاقك؟',
  channelsIntro: 'اختر أداتك الحالية. هناك أكثر من طريق للانضمام إلى بايتلي.',
  sourceLabel: 'أداتك الحالية',
  sourceNote:
    'نطاق النقل يعتمد على البيانات الموجودة في ملفات التصدير والصلاحيات التي تتيحها أداتك.',
  preview: 'مثال لمطابقة الحقول',
  original: 'في المصدر',
  destination: 'في بايتلي',
  mapped: 'حقول متطابقة',
  fields: ['الوحدة', 'تاريخ الوصول', 'مرجع الحجز'],
  channels: [
    {
      name: 'Airbnb وBooking.com',
      title: 'ابدأ من حجوزاتك الحالية.',
      copy: 'نزّل ملفات التصدير من لوحات المنصات. إنها نقطة البداية لاستعادة سجلك في بايتلي.',
      tag: 'من منصات الحجز',
      format: 'CSV / XLS',
      file: 'reservations.csv',
      points: [
        'تصدير المعاملات والحجوزات',
        'مطابقة البيانات مع وحداتك',
        'ربط القنوات في خطوة لاحقة',
      ],
      columns: ['Listing', 'Check-in', 'Confirmation code'],
    },
    {
      name: 'نظام إدارة آخر',
      title: 'لسجلّك قيمة تستحق الاحتفاظ بها.',
      copy: 'Superhote، Smoobu، Guesty، Hostaway، Beds24، OwnerRez: جهّز ملف التصدير، ثم راجع البيانات التي يمكن نقلها.',
      tag: 'من برنامجك',
      format: 'تصدير النظام',
      file: 'pms_history.csv',
      points: [
        'نسخة احتياطية قبل انتهاء الاشتراك',
        'مطابقة الأعمدة مع حقول بايتلي',
        'مراجعة الحجوزات والتكرارات',
      ],
      columns: ['Property name', 'Arrival date', 'Booking ID'],
    },
    {
      name: 'إكسل وملفات',
      title: 'جدولك نقطة بداية عملية.',
      copy: 'تدير نشاطك من ملف؟ يساعدك قالب بايتلي ومطابقة الأعمدة على تنظيم نقل البيانات.',
      tag: 'من تنظيمك الخاص',
      format: 'جدول بيانات',
      file: 'my_reservations.xlsx',
      points: [
        'قالب لتنظيم ملفك',
        'أعمدة يمكنك التعرّف عليها',
        'مراجعة البيانات قبل الانتقال',
      ],
      columns: ['الوحدة', 'الوصول', 'رقم الحجز'],
    },
    {
      name: 'اتصال API',
      title: 'اتصال مباشر عندما تسمح أداتك.',
      copy: 'بحسب الموصل المتاح، يمكن نقل البيانات عبر الواجهة البرمجية. نراجع معك الصلاحيات والبيانات المتاحة.',
      tag: 'بحسب الموصل',
      format: 'API',
      file: 'reservations.json',
      points: [
        'تأكيد توافق أداتك',
        'مراجعة الصلاحيات والنطاق معاً',
        'نقل البيانات المتاحة عبر الواجهة',
      ],
      columns: ['property_name', 'arrival_date', 'reservation_id'],
    },
  ],
  stepsTitle: 'انتقال مُحضّر. خطوة بخطوة.',
  stepsIntro: 'نجهّز مساحتك الجديدة قبل إغلاق القديمة.',
  steps: [
    {
      title: 'نحضّر',
      copy: 'حدّد مصادر بياناتك واحفظ ملفات التصدير قبل إلغاء أداتك الحالية.',
      tag: 'بياناتك عند الانطلاق',
    },
    {
      title: 'ننقل',
      copy: 'طابق الوحدات والإقامات والنزلاء. راجع السجل والتكرارات.',
      tag: 'سجلّك',
    },
    {
      title: 'نعيد الربط',
      copy: 'اربط إعلاناتك الحالية وراجع الحجوزات القادمة على قنواتك.',
      tag: 'قنواتك',
    },
    {
      title: 'تتولى الإدارة',
      copy: 'راجع التقويمات وحضّر الانتقال وابدأ عملك اليومي في بايتلي.',
      tag: 'مساحتك الجديدة',
    },
  ],
  dataTitle: 'مكان واضح لكل معلومة.',
  dataIntro: 'ما ينتقل إلى بايتلي وما يبقى على منصاتك: تعرف ما ينتظرك.',
  data: [
    {
      title: 'وحداتك',
      copy: 'تساعد المعلومات المتاحة في إعادة تنظيم محفظة وحداتك.',
      status: 'تُنقل بحسب المصدر',
    },
    {
      title: 'حجوزاتك ونزلاؤك',
      copy: 'نطابق سجلك وملفاتك لتبدأ بسياق مفيد لعملك.',
      status: 'تُستورد وتُراجع',
    },
    {
      title: 'تقييماتك ودرجاتك',
      copy: 'تبقى مرتبطة بإعلاناتك على Airbnb وBooking.com. تعيد ربط إعلاناتك الحالية.',
      status: 'تبقى على إعلاناتك',
    },
  ],
  guaranteesTitle: 'تتقدم بخطوات مدروسة.',
  guarantees: [
    'لا تُشغّل أتمتة على السجل المستورد',
    'مراجعة المطابقة قبل الانتقال',
    'مراجعة التقويمات خلال الانتقال',
  ],
  limitsTitle: 'وماذا عن رسائلك القديمة؟',
  limitsCopy:
    'إمكانية نقلها تعتمد على خيارات التصدير في كل أداة. لا تعتمد على نقل كامل: احتفظ بنسخة من المحادثات المهمة قبل الإلغاء.',
  supportTitle: 'تغيير الأداة. مع وضوح الطريق.',
  supportCopy:
    'أخبرنا عن تنظيمك ونظامك الحالي ووحداتك. نُعدّ معك نطاق النقل وخطوات الانتقال.',
  supportLanguages: 'الفرنسية · العربية · الدارجة',
  checklistTitle: 'لتحضير حديثنا',
  checklist: [
    'اسم أداتك الحالية',
    'عدد الوحدات المراد نقلها',
    'مثال على ملفات التصدير المتاحة',
  ],
  pricing: 'اكتشف العروض',
};

export const BAITLY_MIGRATION_MESSAGES: Record<
  SiteLanguage,
  BaitlyMigrationMessages
> = { fr, en, ar };
