/**
 * Texte de la projection « Objets connectes ».
 *
 * <p>La projection est lue dans DEUX contextes : l'atelier du design system,
 * ou i18next est initialise, et la landing, ou il ne l'est pas — y charger une
 * locale entiere (800 Ko) pour une quarantaine de libelles serait hors de
 * proportion. Le dictionnaire vit donc ici, et la langue est lue sur
 * l'attribut `lang` du document, que les deux surfaces tiennent a jour.</p>
 *
 * <p>Les libelles reprennent ceux de l'ecran reel (`connectedObjects.*`) : la
 * projection montre le produit, elle ne le paraphrase pas.</p>
 */
const fr = {
  title: 'Objets connectés',
  subtitle: 'Domotique de vos logements : accès, bruit, vidéo, énergie',
  addDevice: 'Ajouter un objet',
  linkedServices: 'Services reliés',
  connectNetatmo: 'Connecter Netatmo',
  manageIntegrations: 'Gérer les intégrations',
  connected: 'Connecté',
  disconnectedHint: 'À reconnecter',
  kpi: {
    devices: 'Objets',
    online: 'En ligne',
    offline: 'Hors ligne',
    alerts: 'Alertes',
    lowBattery: 'Batterie faible',
    fleetShare: '% du parc',
  },
  allDevices: 'Tous les objets',
  kinds: { lock: 'Serrures', noise: 'Capteurs de bruit', camera: 'Caméras', thermostat: 'Thermostats', sensor: 'Sécurité' },
  deviceCount: (n: number) => `${n} objet${n > 1 ? 's' : ''}`,
  accessCode: 'Digicode',
  manage: 'Gérer',
  lock: 'Verrouiller',
  unlock: 'Déverrouiller',
  locked: 'Verrouillée',
  unlocked: 'Déverrouillée',
  offlineSince: 'Hors ligne depuis 26 h',
  live: 'DIRECT',
  ok: 'OK',
  noise: {
    connection: 'Connexion',
    signalHint: 'signal fort · MàJ il y a 40 s',
    current: 'Niveau actuel',
    calm: 'calme',
    average24: 'Moyenne 24 h',
    peak24: 'Pic 24 h',
    peakHint: 'hier à 23 h 41',
    criticalThreshold: '— seuil critique 85 dB',
    configTitle: 'Configuration des alertes bruit',
    slotLabel: 'Label',
    start: 'Début',
    end: 'Fin',
    day: 'Jour',
    night: 'Nuit',
    remove: 'Supprimer',
    inApp: 'In-app',
    email: 'Email',
    guestMessage: 'Message voyageur (WhatsApp)',
  },
  lockDetail: {
    subtitle: 'Serrure entrée · Riad Yasmine · Nuki Smart Lock 4',
    battery: 'Batterie',
    guestName: 'Amina Benali',
    guestCode: 'RES-1042 · valide du 12 au 19 août, 11 h',
    cleaningTeam: 'Équipe ménage',
    cleaningWindow: 'Permanent · 09 h → 17 h uniquement',
    journal: [
      { who: 'Amina Benali', what: 'Ouverture par code guest', time: '15:02' },
      { who: 'Auto', what: 'Verrouillage automatique (3 min)', time: '15:05' },
      { who: 'Fatima Zahra', what: 'Ouverture code ménage', time: '11:12' },
      { who: 'Système', what: 'Code guest RES-1039 expiré', time: 'hier' },
    ],
  },
  cameras: {
    motionDetected: 'Mouvement détecté',
    motion: 'Mouvement',
    fullscreen: 'Plein écran',
    names: ['Entrée principale', 'Terrasse toit', 'Porte palière', 'Jardin'],
  },
  properties: ['Riad Yasmine', 'Appartement Duplex Marrakech'],
  rooms: {
    frontDoor: 'Porte principale',
    landingDoor: 'Porte palière',
    patio: 'Patio',
    lounge: 'Salon',
    outside: 'Extérieur',
    kitchen: 'Cuisine',
  },
  deviceNames: {
    entryLock: 'Serrure entrée',
    noiseSensor: 'Capteur de bruit',
    entryCamera: 'Caméra entrée',
    thermostat: 'Thermostat salon',
    smokeDetector: 'Détecteur de fumée',
  },
};

export type IotDemoMessages = typeof fr;

const en: IotDemoMessages = {
  title: 'Connected devices',
  subtitle: 'Home automation for your properties: access, noise, video, energy',
  addDevice: 'Add a device',
  linkedServices: 'Linked services',
  connectNetatmo: 'Connect Netatmo',
  manageIntegrations: 'Manage integrations',
  connected: 'Connected',
  disconnectedHint: 'Needs reconnecting',
  kpi: {
    devices: 'Devices',
    online: 'Online',
    offline: 'Offline',
    alerts: 'Alerts',
    lowBattery: 'Low battery',
    fleetShare: '% of the fleet',
  },
  allDevices: 'All devices',
  kinds: { lock: 'Locks', noise: 'Noise sensors', camera: 'Cameras', thermostat: 'Thermostats', sensor: 'Safety' },
  deviceCount: (n: number) => `${n} device${n > 1 ? 's' : ''}`,
  accessCode: 'Access code',
  manage: 'Manage',
  lock: 'Lock',
  unlock: 'Unlock',
  locked: 'Locked',
  unlocked: 'Unlocked',
  offlineSince: 'Offline for 26 h',
  live: 'LIVE',
  ok: 'OK',
  noise: {
    connection: 'Connection',
    signalHint: 'strong signal · updated 40 s ago',
    current: 'Current level',
    calm: 'quiet',
    average24: '24 h average',
    peak24: '24 h peak',
    peakHint: 'yesterday at 23:41',
    criticalThreshold: '— critical threshold 85 dB',
    configTitle: 'Noise alert settings',
    slotLabel: 'Label',
    start: 'Start',
    end: 'End',
    day: 'Day',
    night: 'Night',
    remove: 'Remove',
    inApp: 'In-app',
    email: 'Email',
    guestMessage: 'Guest message (WhatsApp)',
  },
  lockDetail: {
    subtitle: 'Entrance lock · Riad Yasmine · Nuki Smart Lock 4',
    battery: 'Battery',
    guestName: 'Amina Benali',
    guestCode: 'RES-1042 · valid 12 to 19 August, 11:00',
    cleaningTeam: 'Cleaning team',
    cleaningWindow: 'Permanent · 09:00 → 17:00 only',
    journal: [
      { who: 'Amina Benali', what: 'Opened with guest code', time: '15:02' },
      { who: 'Auto', what: 'Automatic locking (3 min)', time: '15:05' },
      { who: 'Fatima Zahra', what: 'Opened with cleaning code', time: '11:12' },
      { who: 'System', what: 'Guest code RES-1039 expired', time: 'yesterday' },
    ],
  },
  cameras: {
    motionDetected: 'Motion detected',
    motion: 'Motion',
    fullscreen: 'Fullscreen',
    names: ['Main entrance', 'Roof terrace', 'Landing door', 'Garden'],
  },
  properties: ['Riad Yasmine', 'Duplex apartment, Marrakech'],
  rooms: {
    frontDoor: 'Front door',
    landingDoor: 'Landing door',
    patio: 'Patio',
    lounge: 'Lounge',
    outside: 'Outside',
    kitchen: 'Kitchen',
  },
  deviceNames: {
    entryLock: 'Entrance lock',
    noiseSensor: 'Noise sensor',
    entryCamera: 'Entrance camera',
    thermostat: 'Lounge thermostat',
    smokeDetector: 'Smoke detector',
  },
};

const ar: IotDemoMessages = {
  title: 'الأجهزة المتصلة',
  subtitle: 'أتمتة وحداتك: الدخول، والضجيج، والفيديو، والطاقة',
  addDevice: 'أضف جهازاً',
  linkedServices: 'الخدمات المرتبطة',
  connectNetatmo: 'اربط Netatmo',
  manageIntegrations: 'إدارة التكاملات',
  connected: 'متصل',
  disconnectedHint: 'يحتاج إعادة ربط',
  kpi: {
    devices: 'الأجهزة',
    online: 'متصلة',
    offline: 'غير متصلة',
    alerts: 'تنبيهات',
    lowBattery: 'بطارية منخفضة',
    fleetShare: '% من الأجهزة',
  },
  allDevices: 'كل الأجهزة',
  kinds: { lock: 'الأقفال', noise: 'حساسات الضجيج', camera: 'الكاميرات', thermostat: 'منظّمات الحرارة', sensor: 'السلامة' },
  deviceCount: (n: number) => (n > 1 ? `${n} أجهزة` : `جهاز واحد`),
  accessCode: 'رمز الدخول',
  manage: 'إدارة',
  lock: 'أقفِل',
  unlock: 'افتح',
  locked: 'مقفل',
  unlocked: 'مفتوح',
  offlineSince: 'غير متصل منذ 26 ساعة',
  live: 'مباشر',
  ok: 'سليم',
  noise: {
    connection: 'الاتصال',
    signalHint: 'إشارة قوية · حُدّث قبل 40 ثانية',
    current: 'المستوى الحالي',
    calm: 'هادئ',
    average24: 'متوسط 24 ساعة',
    peak24: 'ذروة 24 ساعة',
    peakHint: 'أمس الساعة 23:41',
    criticalThreshold: '— العتبة الحرجة 85 ديسيبل',
    configTitle: 'إعدادات تنبيهات الضجيج',
    slotLabel: 'التسمية',
    start: 'البداية',
    end: 'النهاية',
    day: 'نهاراً',
    night: 'ليلاً',
    remove: 'احذف',
    inApp: 'داخل التطبيق',
    email: 'البريد الإلكتروني',
    guestMessage: 'رسالة إلى النزيل (واتساب)',
  },
  lockDetail: {
    subtitle: 'قفل المدخل · استراحة الملقا · Nuki Smart Lock 4',
    battery: 'البطارية',
    guestName: 'أمينة بن علي',
    guestCode: 'RES-1042 · صالح من 12 إلى 19 أغسطس، 11:00',
    cleaningTeam: 'فريق التنظيف',
    cleaningWindow: 'دائم · من 09:00 إلى 17:00 فقط',
    journal: [
      { who: 'أمينة بن علي', what: 'فتح برمز النزيل', time: '15:02' },
      { who: 'تلقائي', what: 'إقفال تلقائي (3 دقائق)', time: '15:05' },
      { who: 'فاطمة الزهراء', what: 'فتح برمز التنظيف', time: '11:12' },
      { who: 'النظام', what: 'انتهت صلاحية رمز النزيل RES-1039', time: 'أمس' },
    ],
  },
  cameras: {
    motionDetected: 'رُصدت حركة',
    motion: 'حركة',
    fullscreen: 'ملء الشاشة',
    names: ['المدخل الرئيسي', 'سطح الشرفة', 'باب الطابق', 'الحديقة'],
  },
  properties: ['استراحة الملقا', 'شقة دوبلكس، جدة'],
  rooms: {
    frontDoor: 'الباب الرئيسي',
    landingDoor: 'باب الطابق',
    patio: 'الفناء',
    lounge: 'الصالة',
    outside: 'الخارج',
    kitchen: 'المطبخ',
  },
  deviceNames: {
    entryLock: 'قفل المدخل',
    noiseSensor: 'حسّاس الضجيج',
    entryCamera: 'كاميرا المدخل',
    thermostat: 'منظّم حرارة الصالة',
    smokeDetector: 'كاشف الدخان',
  },
};

const BY_LANGUAGE: Record<string, IotDemoMessages> = { fr, en, ar };

/**
 * Texte de la projection, dans la langue du document.
 *
 * <p>`document.documentElement.lang` est la seule source que les deux surfaces
 * partagent : le fournisseur de langue de la landing la pose, i18next la pose
 * dans l'application. Lire ailleurs demanderait un contexte que la projection
 * n'a pas le droit d'exiger.</p>
 */
export function iotDemoText(): IotDemoMessages {
  const lang = typeof document !== 'undefined'
    ? (document.documentElement.lang || 'fr').split('-')[0]
    : 'fr';
  return BY_LANGUAGE[lang] ?? fr;
}
