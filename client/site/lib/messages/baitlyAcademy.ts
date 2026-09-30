/*
  Baitly Académie · textes du lecteur vidéo, des épisodes et du programme (FR, EN, AR).
  Les données techniques des épisodes (durée, début des chapitres, transcription) sont générées dans
  data/baitlyAcademyVideos.ts ; ici, seulement ce qui s'affiche. Chaque épisode publié doit avoir
  autant de libellés de chapitres que de chapitres dans le catalogue (vérifié par les tests).
  Les vidéos n'existent pour l'instant qu'en français : en anglais et en arabe, la page affiche la
  vidéo française avec `languageNote`.
*/
import type { SiteLanguage } from '../siteLanguage';
import type { AcademyTheme } from '../../data/baitlyAcademyVideos';

export interface AcademyEpisodeText {
  title: string;
  description: string;
  learn: readonly string[];
  chapters: readonly string[];
}

export interface AcademyMessages {
  ui: {
    series: string;
    episode: string;
    /** Pluriel, après un nombre : « 3 épisodes ». */
    episodes: string;
    latest: string;
    play: string;
    pause: string;
    mute: string;
    unmute: string;
    fullscreen: string;
    seek: string;
    /** « 1:02 sur 2:43 » pour les lecteurs d'écran. */
    of: string;
    chapters: string;
    learn: string;
    /** Titre de la transcription dans la version Markdown de la page (non affichée). */
    transcript: string;
    practice: string;
    practiceTitle: string;
    practiceCopy: string;
    program: string;
    /** {available} et {soon} sont remplacés par des nombres. */
    programCount: string;
    soon: string;
    legalReview: string;
    unavailable: string;
    languageNote: string;
    watch: string;
    formats: string;
    minutes: string;
    /** Fin d'épisode : proposition de l'épisode suivant. */
    upNext: string;
    playNext: string;
    /** {seconds} est remplacé par le nombre de secondes restantes. */
    autoplayIn: string;
    cancelAutoplay: string;
    replay: string;
    /** Fin du dernier épisode publié. */
    seriesDone: string;
    seeProgram: string;
  };
  themes: Record<AcademyTheme, string>;
  episodes: Record<string, AcademyEpisodeText>;
  /** Le programme complet de la série, épisodes publiés et à venir. */
  program: readonly { number: string; theme: AcademyTheme; title: string; legal?: boolean }[];
}

const PROGRAM_THEMES: readonly [string, AcademyTheme, boolean?][] = [
  ['01', 'piloter'], ['02', 'piloter'], ['03', 'piloter'], ['04', 'piloter'],
  ['05', 'reglementation', true], ['06', 'reglementation', true], ['07', 'reglementation', true],
  ['08', 'reglementation', true], ['09', 'reglementation', true], ['10', 'reglementation', true],
  ['11', 'securite'], ['12', 'securite'],
  ['13', 'operations'], ['14', 'operations'], ['15', 'operations'], ['16', 'operations'],
  ['17', 'revenus'], ['18', 'revenus'], ['19', 'revenus'],
  ['20', 'conciergeries'],
];
const program = (titles: readonly string[]) =>
  PROGRAM_THEMES.map(([number, theme, legal], index) => ({ number, theme, title: titles[index], ...(legal ? { legal } : {}) }));

const fr: AcademyMessages = {
  ui: {
    series: 'Formations vidéo',
    episode: 'Épisode',
    episodes: 'épisodes',
    latest: 'Dernier épisode',
    play: 'Lire la vidéo',
    pause: 'Mettre en pause',
    mute: 'Couper le son',
    unmute: 'Remettre le son',
    fullscreen: 'Plein écran',
    seek: 'Position dans la vidéo',
    of: 'sur',
    chapters: 'Chapitres',
    learn: 'Vous allez apprendre',
    transcript: 'Transcription de l’épisode',
    practice: 'Mettre en pratique',
    practiceTitle: 'Mise en pratique',
    practiceCopy: 'Trois leçons écrites, chacune avec un cas à résoudre, pour appliquer tout de suite.',
    program: 'Le programme',
    programCount: '{available} épisodes disponibles · {soon} en préparation',
    soon: 'Bientôt',
    legalReview: 'Relu par un juriste',
    unavailable: 'La vidéo n’est pas disponible pour le moment. Revenez un peu plus tard.',
    languageNote: '',
    watch: 'Regarder',
    formats: 'Sur ordinateur et sur téléphone',
    minutes: 'min',
    upNext: 'À suivre',
    playNext: 'Lire l’épisode suivant',
    autoplayIn: 'Lecture automatique dans {seconds} s',
    cancelAutoplay: 'Annuler',
    replay: 'Revoir',
    seriesDone: 'Vous avez vu tous les épisodes disponibles.',
    seeProgram: 'Voir le programme',
  },
  themes: {
    piloter: 'Piloter',
    revenus: 'Revenus',
    reglementation: 'Réglementation',
    operations: 'Opérations',
    securite: 'Sécurité',
    conciergeries: 'Conciergeries',
  },
  episodes: {
    '01-kpi': {
      title: 'Les 3 KPI de base',
      description:
        'Taux d’occupation, prix moyen et RevPAR : les calculer, éviter deux pièges courants et lire les trois ensemble pour décider.',
      learn: [
        'Calculer l’occupation, le prix moyen et le RevPAR',
        'Éviter deux pièges : les nuits bloquées et les frais comptés à tort',
        'Lire les trois chiffres ensemble pour décider',
      ],
      chapters: ['Accroche', 'Taux d’occupation', 'Prix moyen (ADR)', 'RevPAR', 'Trois stratégies', 'Lire les trois ensemble', 'À retenir'],
    },
    '02-revenu-net': {
      title: 'Votre revenu net, vraiment',
      description:
        'Du prix payé par le voyageur à ce qui vous reste : taxe de séjour, commission, coûts du séjour et charges du mois, calculés sur un exemple.',
      learn: [
        'Suivre l’argent, du prix payé jusqu’au net',
        'Repérer deux pièges : le versement et les frais de ménage',
        'Calculer votre revenu net du mois',
      ],
      chapters: ['Accroche', 'Ce que paie le voyageur', 'La commission', 'Les coûts du séjour', 'Le mois', 'Que faire de ce chiffre ?', 'À retenir'],
    },
    '18-direct-ou-plateforme': {
      title: 'Réservation directe ou plateforme ?',
      description:
        'Le vrai coût d’une commission, ce que demande la réservation directe, le seuil où elle devient rentable et la stratégie qui combine les deux.',
      learn: [
        'Comparer le net d’un même séjour selon le canal',
        'Trouver le seuil où le direct devient rentable',
        'Faire revenir vos voyageurs, dans les règles des plateformes',
      ],
      chapters: ['Accroche', 'Le calcul', 'Ce que chacun coûte', 'Le seuil', 'La stratégie', 'L’équilibre', 'À retenir'],
    },
    '03-delai-duree': {
      title: 'Délai de réservation et durée de séjour',
      description:
        'Quand vos voyageurs réservent et combien de temps ils restent : deux chiffres qui disent quand agir sur vos prix et ce que coûte chaque réservation.',
      learn: [
        'Calculer le délai de réservation et savoir si vous êtes en retard',
        'Mesurer la durée moyenne de séjour et son coût en ménages',
        'Repérer et combler les nuits orphelines',
      ],
      chapters: ['Accroche', 'Le délai de réservation', 'La durée de séjour', 'Les nuits orphelines', 'Que faire de ces chiffres ?', 'À retenir'],
    },
    '04-qualite': {
      title: 'Annulations, avis, temps de réponse',
      description:
        'Trois indicateurs de qualité qui peuvent freiner vos réservations : les annulations de votre fait, le nombre et la note de vos avis, votre réactivité.',
      learn: [
        'Calculer votre taux d’annulation et éviter celles de votre fait',
        'Comprendre pourquoi le nombre d’avis protège votre note',
        'Mesurer votre taux de réponse et répondre plus vite',
      ],
      chapters: ['Accroche', 'Les annulations', 'Les avis', 'La réactivité', 'Que faire ?', 'À retenir'],
    },
    '17-prix-dynamique': {
      title: 'Le prix dynamique en 3 règles',
      description:
        'Un plancher calculé sur le coût réel d’une nuit, des week-ends au prix de la demande, une dernière minute par paliers : trois règles pour ne plus vendre au même prix toute l’année.',
      learn: [
        'Calculer votre prix plancher, commission de la plateforme comprise',
        'Augmenter vos week-ends et repérer un prix trop bas',
        'Baisser à la dernière minute sans passer sous le plancher',
      ],
      chapters: ['Accroche', 'Le plancher', 'Les week-ends', 'La dernière minute', 'En pratique', 'À retenir'],
    },
    '19-extras': {
      title: 'Les extras qui rapportent',
      description:
        'Arrivée anticipée, départ tardif, transfert, activités GetYourGuide, Viator et Klook, extras sur mesure et packs : ce que vous pouvez vendre en plus du séjour, et quand le proposer.',
      learn: [
        'Choisir et chiffrer les extras de votre logement',
        'Toucher une commission sur les activités de GetYourGuide, Viator et Klook',
        'Créer vos extras sur mesure et vos packs, et les proposer au bon moment',
      ],
      chapters: ['Accroche', 'Vos services', 'Les activités', 'Sur mesure', 'Le bon moment', 'À retenir'],
    },
  },
  program: program([
    'Les 3 KPI de base',
    'Votre revenu net, vraiment',
    'Délai de réservation et durée de séjour',
    'Annulations, avis, temps de réponse',
    'France · avant de mettre en location',
    'France · fiscalité des meublés de tourisme',
    'France · taxe de séjour et fiche de police',
    'Maroc · louer légalement',
    'Arabie saoudite · louer légalement',
    'Les obligations avant la première réservation',
    'La checklist sécurité du logement',
    'Votre assurance couvre-t-elle la location courte durée ?',
    'Le ménage de rotation en 5 étapes',
    'Les 7 questions que tous les voyageurs posent',
    'Répondre à un avis négatif',
    'Caution et dépôt de garantie',
    'Le prix dynamique en 3 règles',
    'Réservation directe ou plateforme ?',
    'Les extras qui rapportent',
    'Gérer pour le compte d’un propriétaire',
  ]),
};

const en: AcademyMessages = {
  ui: {
    series: 'Video training',
    episode: 'Episode',
    episodes: 'episodes',
    latest: 'Latest episode',
    play: 'Play video',
    pause: 'Pause',
    mute: 'Mute',
    unmute: 'Unmute',
    fullscreen: 'Full screen',
    seek: 'Video position',
    of: 'of',
    chapters: 'Chapters',
    learn: 'You will learn',
    transcript: 'Episode transcript',
    practice: 'Put it into practice',
    practiceTitle: 'Put it into practice',
    practiceCopy: 'Three written lessons, each with a case to solve, so you can apply them right away.',
    program: 'The programme',
    programCount: '{available} episodes available · {soon} in preparation',
    soon: 'Coming soon',
    legalReview: 'Reviewed by a lawyer',
    unavailable: 'The video is not available right now. Please come back a little later.',
    languageNote: 'Video in French',
    watch: 'Watch',
    formats: 'On desktop and on mobile',
    minutes: 'min',
    upNext: 'Up next',
    playNext: 'Play next episode',
    autoplayIn: 'Playing automatically in {seconds} s',
    cancelAutoplay: 'Cancel',
    replay: 'Watch again',
    seriesDone: 'You have watched every episode available.',
    seeProgram: 'See the programme',
  },
  themes: {
    piloter: 'Performance',
    revenus: 'Revenue',
    reglementation: 'Regulation',
    operations: 'Operations',
    securite: 'Safety',
    conciergeries: 'Property managers',
  },
  episodes: {
    '01-kpi': {
      title: 'The 3 core KPIs',
      description:
        'Occupancy rate, average daily rate and RevPAR: how to calculate them, avoid two common traps and read all three together to decide.',
      learn: [
        'Calculate occupancy, average daily rate and RevPAR',
        'Avoid two traps: blocked nights and fees counted as revenue',
        'Read the three figures together to decide',
      ],
      chapters: ['Introduction', 'Occupancy rate', 'Average daily rate (ADR)', 'RevPAR', 'Three strategies', 'Reading all three together', 'Key takeaways'],
    },
    '02-revenu-net': {
      title: 'Your real net income',
      description:
        'From the price the guest pays to what you actually keep: tourist tax, commission, stay costs and monthly charges, worked through on one example.',
      learn: [
        'Follow the money from the price paid to net income',
        'Spot two traps: the payout and the cleaning fee',
        'Calculate your net income for the month',
      ],
      chapters: ['Introduction', 'What the guest pays', 'The commission', 'The cost of each stay', 'The month', 'What to do with this figure', 'Key takeaways'],
    },
    '18-direct-ou-plateforme': {
      title: 'Direct booking or platform?',
      description:
        'The real cost of a commission, what direct booking requires, the point where it pays off and the strategy that combines both.',
      learn: [
        'Compare the net of the same stay by channel',
        'Find the point where direct booking pays off',
        'Bring guests back while respecting platform rules',
      ],
      chapters: ['Introduction', 'The calculation', 'What each channel costs', 'The break-even point', 'The strategy', 'Finding the balance', 'Key takeaways'],
    },
    '03-delai-duree': {
      title: 'Booking lead time and length of stay',
      description:
        'When your guests book and how long they stay: two figures that tell you when to act on your prices and what each booking really costs.',
      learn: [
        'Calculate booking lead time and see whether you are behind',
        'Measure average length of stay and its cost in cleanings',
        'Spot and fill orphan nights',
      ],
      chapters: ['Introduction', 'Booking lead time', 'Length of stay', 'Orphan nights', 'What to do with these figures', 'Key takeaways'],
    },
    '04-qualite': {
      title: 'Cancellations, reviews, response time',
      description:
        'Three quality indicators that can slow your bookings down: cancellations on your side, the number and rating of your reviews, and how fast you reply.',
      learn: [
        'Calculate your cancellation rate and avoid cancelling yourself',
        'Understand why the number of reviews protects your rating',
        'Measure your response rate and reply faster',
      ],
      chapters: ['Introduction', 'Cancellations', 'Reviews', 'Responsiveness', 'What to do', 'Key takeaways'],
    },
    '17-prix-dynamique': {
      title: 'Dynamic pricing in 3 rules',
      description:
        'A floor based on the real cost of a night, weekends priced to demand, last-minute discounts in steps: three rules to stop charging the same price all year round.',
      learn: [
        'Calculate your floor price, platform commission included',
        'Raise your weekend prices and spot a price that is too low',
        'Lower prices at the last minute without going below the floor',
      ],
      chapters: ['Introduction', 'The floor', 'Weekends', 'Last minute', 'In practice', 'Key takeaways'],
    },
    '19-extras': {
      title: 'Extras that pay',
      description:
        'Early check-in, late check-out, transfers, GetYourGuide, Viator and Klook activities, custom extras and bundles: what you can sell on top of the stay, and when to offer it.',
      learn: [
        'Choose and price the extras for your property',
        'Earn a commission on GetYourGuide, Viator and Klook activities',
        'Create custom extras and bundles, and offer them at the right time',
      ],
      chapters: ['Introduction', 'Your services', 'Activities', 'Custom extras', 'The right time', 'Key takeaways'],
    },
  },
  program: program([
    'The 3 core KPIs',
    'Your real net income',
    'Booking lead time and length of stay',
    'Cancellations, reviews, response time',
    'France · before you list your property',
    'France · taxation of furnished holiday lets',
    'France · tourist tax and guest registration form',
    'Morocco · renting legally',
    'Saudi Arabia · renting legally',
    'Your obligations before the first booking',
    'The property safety checklist',
    'Does your insurance cover short-term rentals?',
    'Turnover cleaning in 5 steps',
    'The 7 questions every guest asks',
    'Replying to a negative review',
    'Security deposits',
    'Dynamic pricing in 3 rules',
    'Direct booking or platform?',
    'Extras that pay off',
    'Managing on behalf of an owner',
  ]),
};

const ar: AcademyMessages = {
  ui: {
    series: 'دورات بالفيديو',
    episode: 'الحلقة',
    episodes: 'حلقات',
    latest: 'أحدث حلقة',
    play: 'تشغيل الفيديو',
    pause: 'إيقاف مؤقت',
    mute: 'كتم الصوت',
    unmute: 'تشغيل الصوت',
    fullscreen: 'ملء الشاشة',
    seek: 'موضع الفيديو',
    of: 'من',
    chapters: 'الفصول',
    learn: 'ستتعلّم',
    transcript: 'نص الحلقة',
    practice: 'طبّق ما تعلّمته',
    practiceTitle: 'التطبيق العملي',
    practiceCopy: 'ثلاثة دروس مكتوبة، في كل منها حالة لحلّها، لتطبّق فوراً.',
    program: 'البرنامج',
    programCount: '{available} حلقات متاحة · {soon} قيد الإعداد',
    soon: 'قريباً',
    legalReview: 'راجعه محامٍ',
    unavailable: 'الفيديو غير متاح حالياً. يُرجى العودة بعد قليل.',
    languageNote: 'الفيديو باللغة الفرنسية',
    watch: 'شاهد',
    formats: 'على الحاسوب وعلى الهاتف',
    minutes: 'د',
    upNext: 'التالي',
    playNext: 'تشغيل الحلقة التالية',
    autoplayIn: 'يبدأ التشغيل تلقائياً خلال {seconds} ث',
    cancelAutoplay: 'إلغاء',
    replay: 'إعادة المشاهدة',
    seriesDone: 'شاهدت كل الحلقات المتاحة.',
    seeProgram: 'عرض البرنامج',
  },
  themes: {
    piloter: 'القيادة',
    revenus: 'الإيرادات',
    reglementation: 'التشريعات',
    operations: 'العمليات',
    securite: 'السلامة',
    conciergeries: 'شركات الإدارة',
  },
  episodes: {
    '01-kpi': {
      title: 'مؤشرات الأداء الثلاثة الأساسية',
      description:
        'نسبة الإشغال ومتوسط سعر الليلة والعائد لكل ليلة متاحة (RevPAR): كيف تحسبها، وكيف تتجنّب خطأين شائعين، وكيف تقرأها معاً لتتخذ قرارك.',
      learn: [
        'حساب نسبة الإشغال ومتوسط السعر والعائد لكل ليلة متاحة',
        'تجنّب خطأين: الليالي المحجوبة والرسوم المحسوبة كإيراد',
        'قراءة الأرقام الثلاثة معاً لاتخاذ القرار',
      ],
      chapters: ['المقدمة', 'نسبة الإشغال', 'متوسط سعر الليلة (ADR)', 'RevPAR', 'ثلاث استراتيجيات', 'قراءة المؤشرات معاً', 'الخلاصة'],
    },
    '02-revenu-net': {
      title: 'صافي دخلك الحقيقي',
      description:
        'من السعر الذي يدفعه الضيف إلى ما يبقى لك فعلاً: ضريبة الإقامة والعمولة وتكاليف الإقامة ومصاريف الشهر، محسوبة على مثال واحد.',
      learn: [
        'تتبّع المال من السعر المدفوع حتى الصافي',
        'اكتشاف خطأين: التحويل ورسوم التنظيف',
        'حساب صافي دخلك الشهري',
      ],
      chapters: ['المقدمة', 'ما يدفعه الضيف', 'العمولة', 'تكاليف الإقامة', 'الشهر', 'ماذا تفعل بهذا الرقم؟', 'الخلاصة'],
    },
    '18-direct-ou-plateforme': {
      title: 'حجز مباشر أم عبر المنصة؟',
      description:
        'التكلفة الحقيقية للعمولة، وما يتطلبه الحجز المباشر، والنقطة التي يصبح عندها مربحاً، والاستراتيجية التي تجمع بين الاثنين.',
      learn: [
        'مقارنة صافي الإقامة نفسها حسب القناة',
        'تحديد النقطة التي يصبح عندها الحجز المباشر مربحاً',
        'إعادة ضيوفك مع احترام قواعد المنصات',
      ],
      chapters: ['المقدمة', 'الحساب', 'تكلفة كل قناة', 'نقطة التعادل', 'الاستراتيجية', 'التوازن', 'الخلاصة'],
    },
    '03-delai-duree': {
      title: 'مهلة الحجز ومدة الإقامة',
      description:
        'متى يحجز ضيوفك وكم يقيمون: رقمان يخبرانك متى تتدخّل في أسعارك وكم تكلّفك كل حجز فعلاً.',
      learn: [
        'حساب مهلة الحجز ومعرفة إن كنت متأخراً',
        'قياس متوسط مدة الإقامة وتكلفتها في التنظيف',
        'اكتشاف الليالي اليتيمة وملؤها',
      ],
      chapters: ['المقدمة', 'مهلة الحجز', 'مدة الإقامة', 'الليالي اليتيمة', 'ماذا تفعل بهذه الأرقام؟', 'الخلاصة'],
    },
    '04-qualite': {
      title: 'الإلغاءات والتقييمات وسرعة الرد',
      description:
        'ثلاثة مؤشرات جودة قد تُبطئ حجوزاتك: الإلغاءات من جهتك، وعدد تقييماتك ومعدّلها، وسرعة ردّك.',
      learn: [
        'حساب نسبة الإلغاء وتجنّب الإلغاء من جهتك',
        'فهم لماذا يحمي عدد التقييمات معدّلك',
        'قياس نسبة الرد والرد بشكل أسرع',
      ],
      chapters: ['المقدمة', 'الإلغاءات', 'التقييمات', 'سرعة الرد', 'ماذا تفعل؟', 'الخلاصة'],
    },
    '17-prix-dynamique': {
      title: 'التسعير الديناميكي في 3 قواعد',
      description:
        'حدّ أدنى محسوب على التكلفة الفعلية لليلة، وعطلات نهاية أسبوع بسعر الطلب، وتخفيض في اللحظة الأخيرة على مراحل: ثلاث قواعد حتى لا تبيع بالسعر نفسه طوال السنة.',
      learn: [
        'حساب سعرك الأدنى مع احتساب عمولة المنصة',
        'رفع أسعار عطلة نهاية الأسبوع واكتشاف السعر المنخفض أكثر من اللازم',
        'التخفيض في اللحظة الأخيرة دون النزول تحت الحد الأدنى',
      ],
      chapters: ['المقدمة', 'الحد الأدنى', 'عطلات نهاية الأسبوع', 'اللحظة الأخيرة', 'في التطبيق', 'الخلاصة'],
    },
    '19-extras': {
      title: 'الخدمات الإضافية المربحة',
      description:
        'الوصول المبكر، والمغادرة المتأخرة، والنقل، وأنشطة GetYourGuide وViator وKlook، والخدمات المخصّصة والباقات: ما يمكنك بيعه إضافةً إلى الإقامة، ومتى تعرضه.',
      learn: [
        'اختيار الخدمات الإضافية لمسكنك وتسعيرها',
        'الحصول على عمولة من أنشطة GetYourGuide وViator وKlook',
        'إنشاء خدماتك المخصّصة وباقاتك وعرضها في الوقت المناسب',
      ],
      chapters: ['المقدمة', 'خدماتك', 'الأنشطة', 'خدمات مخصّصة', 'الوقت المناسب', 'الخلاصة'],
    },
  },
  program: program([
    'مؤشرات الأداء الثلاثة الأساسية',
    'صافي دخلك الحقيقي',
    'مهلة الحجز ومدة الإقامة',
    'الإلغاءات والتقييمات وسرعة الرد',
    'فرنسا · قبل عرض مسكنك للإيجار',
    'فرنسا · ضرائب الشقق المفروشة السياحية',
    'فرنسا · ضريبة الإقامة واستمارة تسجيل الضيوف',
    'المغرب · التأجير بشكل قانوني',
    'السعودية · التأجير بشكل نظامي',
    'الالتزامات قبل أول حجز',
    'قائمة السلامة في المسكن',
    'هل يغطي تأمينك الإيجار قصير المدى؟',
    'تنظيف ما بين الإقامات في 5 خطوات',
    'الأسئلة السبعة التي يطرحها كل الضيوف',
    'الرد على تقييم سلبي',
    'مبلغ التأمين والضمان',
    'التسعير الديناميكي في 3 قواعد',
    'حجز مباشر أم عبر المنصة؟',
    'الخدمات الإضافية المربحة',
    'الإدارة لحساب مالك العقار',
  ]),
};

export const BAITLY_ACADEMY_MESSAGES: Record<SiteLanguage, AcademyMessages> = { fr, en, ar };

/** Remplace {clé} dans un gabarit de texte. */
export function fillAcademyText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
