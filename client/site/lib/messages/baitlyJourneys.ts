import type { SiteLanguage } from '../siteLanguage';

const fr = {
  solutions: {
    eyebrow: 'Solutions Baitly',
    title: 'Votre métier donne\nle rythme.',
    intro:
      'Un hôte, une conciergerie et une maison d’hôtes ne vivent pas la même journée. Explorez le parcours qui ressemble à la vôtre.',
    choose: 'Votre activité',
    demo: 'Scénarios de démonstration · Données fictives',
    modules: 'Les modules à explorer',
    scenario: 'Une journée, un exemple',
    pricing: 'Trouver mon offre',
    countriesTitle: 'Votre activité ici.\nVos repères locaux aussi.',
    countriesCopy:
      'Les marchés présentés par Baitly ont chacun leurs démarches et leurs moyens de paiement. Vérifiez le périmètre disponible au lancement pour votre établissement.',
    guide: 'Consulter le guide des obligations',
    countries: [
      {
        name: 'Maroc',
        copy: 'Préparer les informations voyageurs, les démarches de l’établissement et les encaissements en dirhams.',
      },
      {
        name: 'Arabie saoudite',
        copy: 'Identifier les démarches locales et les prérequis de vos connexions avant de configurer le produit.',
      },
      {
        name: 'France',
        copy: 'Retrouver les démarches de location touristique et préparer vos informations de facturation en euros.',
      },
    ],
    closingTitle: 'Commencez par votre quotidien.',
    closingCopy:
      'Explorez les démos, estimez votre abonnement et préparez votre changement d’outil.',
    migration: 'Préparer ma migration',
    stories: [
      {
        name: 'Conciergeries',
        title: 'Une arrivée à coordonner.\nUne équipe au courant.',
        copy: 'Quand les départs, les ménages et les arrivées se croisent, chaque intervenant a besoin de savoir ce qu’il doit faire.',
        steps: [
          {
            title: 'La réservation arrive',
            copy: 'Le planning rassemble le séjour et les informations du logement.',
          },
          {
            title: 'L’équipe prend le relais',
            copy: 'Les consignes et les photos accompagnent l’intervention.',
          },
          {
            title: 'Le propriétaire suit son bien',
            copy: 'Son portail rassemble les informations qui le concernent.',
          },
        ],
        question: 'Puis-je garder la main sur les opérations ?',
        answer:
          'Les démonstrations présentent les étapes de suivi et de validation. Le périmètre des rôles se précise lors de la configuration.',
      },
      {
        name: 'Hôtes indépendants',
        title: 'Moins de messages à répéter.\nPlus de temps pour accueillir.',
        copy: 'Une question sur l’arrivée, une réservation à confirmer, un service à proposer : retrouvez le fil du séjour.',
        steps: [
          {
            title: 'Préparer la réponse',
            copy: 'L’agent propose un message que vous pouvez relire.',
          },
          {
            title: 'Partager le livret',
            copy: 'Le voyageur retrouve les horaires et les informations utiles.',
          },
          {
            title: 'Accueillir en direct',
            copy: 'Votre site présente le logement et les extras du séjour.',
          },
        ],
        question: 'L’IA décide-t-elle à ma place ?',
        answer:
          'Explorez les règles de validation dans la démo des agents. Les actions autorisées doivent correspondre à votre configuration.',
      },
      {
        name: 'Riads & maisons d’hôtes',
        title: 'Des chambres à préparer.\nUn séjour à faire découvrir.',
        copy: 'Le voyage commence par une chambre. Il continue avec le petit-déjeuner, les attentions et les conseils de votre équipe.',
        steps: [
          {
            title: 'Choisir sa chambre',
            copy: 'Le voyageur explore votre site et sélectionne son séjour.',
          },
          {
            title: 'Ajouter une attention',
            copy: 'Il découvre les services proposés avec sa réservation.',
          },
          {
            title: 'Préparer son arrivée',
            copy: 'Le livret rassemble les informations utiles sur place.',
          },
        ],
        question: 'Puis-je présenter mes propres services ?',
        answer:
          'Les démos montrent un catalogue d’extras associé au séjour. Prix, disponibilités et conditions dépendent de votre offre.',
      },
      {
        name: 'Multi-propriétaires',
        title: 'Un portefeuille partagé.\nDes informations bien séparées.',
        copy: 'Chaque propriétaire doit comprendre son activité sans accéder aux informations des autres mandants.',
        steps: [
          {
            title: 'Suivre chaque logement',
            copy: 'Le planning donne une vue d’ensemble du portefeuille.',
          },
          {
            title: 'Lire son relevé',
            copy: 'Le portail présente les montants et les documents du propriétaire.',
          },
          {
            title: 'Contrôler les accès',
            copy: 'Les rôles déterminent quelles informations sont visibles.',
          },
        ],
        question: 'Tous les propriétaires voient-ils les mêmes données ?',
        answer:
          'Le portail est présenté avec un accès limité au périmètre du propriétaire. Vérifiez les droits lors du paramétrage.',
      },
    ],
  },
  welcome: {
    eyebrow: 'Livret d’accueil & expériences',
    title: 'Votre accueil,\ndans leur poche.',
    intro:
      'Les bonnes informations au bon moment : l’arrivée, la maison, vos adresses et les petites attentions qui complètent le séjour.',
    demo: 'Suivre le parcours',
    contact: 'Découvrir Baitly',
    pricing: 'Voir les offres',
    example: 'Livret de démonstration · Données fictives',
    hello: 'Bienvenue chez vous',
    property: 'Maison Zayna',
    location: 'Marrakech',
    arrival: 'Votre arrivée',
    arrivalCopy: 'À partir de 15 h · Départ avant 11 h',
    essentials: 'Les essentiels',
    wifi: 'Wi-Fi',
    access: 'Accès au logement',
    accessCopy: 'Les consignes pour trouver la maison',
    extras: 'Pour compléter votre séjour',
    hostTitle: 'Vous préparez.\nLe voyageur découvre.',
    hostCopy:
      'Modifiez cet exemple et observez le résultat dans le téléphone. Tout reste dans cette démonstration.',
    host: 'Côté hôte',
    guest: 'Côté voyageur',
    steps: ['Votre accueil', 'Les essentiels', 'Vos extras'],
    welcomeLabel: 'Votre mot d’accueil',
    defaultWelcome:
      'Bienvenue à Maison Zayna. Installez-vous, nous avons réuni ici nos conseils pour profiter de votre séjour.',
    wifiLabel: 'Afficher les informations Wi-Fi',
    arrivalLabel: 'Afficher les horaires d’arrivée et de départ',
    extrasLabel: 'Choisir les services à présenter',
    extraNames: ['Petit-déjeuner au patio', 'Départ tardif'],
    extraCopy: [
      'Pour bien commencer la journée',
      'Profitez de la maison un peu plus longtemps',
    ],
    previewEmpty: 'Votre sélection de services apparaîtra ici.',
    saved: 'Aperçu mis à jour',
    pause: 'Mettre en pause',
    play: 'Reprendre la démo',
    note: 'Prix illustratifs en euros. Aucune réservation ni publication réelle.',
    journeyTitle: 'Avant, pendant, autour du séjour.',
    journey: [
      {
        title: 'Préparer l’arrivée',
        copy: 'Rassemblez l’adresse, les horaires et les consignes utiles.',
      },
      {
        title: 'Retrouver l’essentiel',
        copy: 'Le voyageur consulte le livret depuis un lien, sans installer d’application.',
      },
      {
        title: 'Découvrir vos services',
        copy: 'Présentez les extras et les expériences avec leurs conditions.',
      },
    ],
    catalogTitle: 'Vos services.\nLes bonnes conditions.',
    catalogCaption: 'La cuisine locale, à découvrir pendant le séjour',
    catalogCopy:
      'Composez votre sélection : petit-déjeuner, départ tardif, transfert ou activité. Les offres partenaires dépendent des connexions et du catalogue disponibles au lancement.',
    catalogNote:
      'Les exemples de catalogue ne constituent pas une liste de partenaires activés. Les frais et modalités sont à confirmer avant souscription.',
    bookingLink: 'Voir aussi les extras du booking engine',
    faqTitle: 'Avant de créer votre livret',
    faq: [
      {
        q: 'Le voyageur doit-il installer une application ?',
        a: 'Le parcours présenté s’ouvre depuis un lien web. Il est conçu pour être consulté sur téléphone.',
      },
      {
        q: 'Cette démo publie-t-elle un véritable livret ?',
        a: 'Non. Ce parcours illustre l’arrivée et la consultation du livret avec des données fictives. Il ne publie rien et ne transmet aucune déclaration.',
      },
      {
        q: 'Les services sont-ils tous disponibles dès le lancement ?',
        a: 'Le catalogue, les connexions et les conditions de vente seront précisés selon votre offre et votre marché.',
      },
    ],
    closing: 'Préparez un accueil à votre image.',
    closingCopy:
      'Explorez le parcours, puis découvrez l’offre adaptée à votre activité.',
  },
};
type JourneyMessages = typeof fr;
const en: JourneyMessages = {
  solutions: {
    eyebrow: 'Baitly solutions',
    title: 'Your business sets\nthe pace.',
    intro:
      'A host, a property manager and a guesthouse have different days. Explore the workflow that feels like yours.',
    choose: 'Your activity',
    demo: 'Demonstration scenarios · Fictional data',
    modules: 'Modules to explore',
    scenario: 'A day, an example',
    pricing: 'Find my plan',
    countriesTitle: 'Your business.\nYour local context.',
    countriesCopy:
      'Baitly’s presented markets have different procedures and payment methods. Check the scope available at launch for your property.',
    guide: 'Read the obligations guide',
    countries: [
      {
        name: 'Morocco',
        copy: 'Prepare guest information, property procedures and payments in dirhams.',
      },
      {
        name: 'Saudi Arabia',
        copy: 'Identify local procedures and connection requirements before configuring the product.',
      },
      {
        name: 'France',
        copy: 'Explore tourist rental procedures and prepare your invoicing information in euros.',
      },
    ],
    closingTitle: 'Start with your daily work.',
    closingCopy:
      'Explore the demos, estimate your subscription and prepare your move.',
    migration: 'Prepare my migration',
    stories: [
      {
        name: 'Property managers',
        title: 'An arrival to coordinate.\nA team kept informed.',
        copy: 'When departures, cleaning and arrivals overlap, each team member needs to know what to do.',
        steps: [
          {
            title: 'The booking arrives',
            copy: 'The calendar brings together the stay and property details.',
          },
          {
            title: 'The team takes over',
            copy: 'Instructions and photos support the job.',
          },
          {
            title: 'The owner follows along',
            copy: 'Their portal collects the information relevant to them.',
          },
        ],
        question: 'Can I stay in control of operations?',
        answer:
          'The demonstrations show progress and approval steps. Roles are defined during configuration.',
      },
      {
        name: 'Independent hosts',
        title: 'Fewer repeated messages.\nMore time to welcome.',
        copy: 'An arrival question, a booking to confirm, a service to offer: keep track of the stay.',
        steps: [
          {
            title: 'Prepare a reply',
            copy: 'The agent proposes a message for you to review.',
          },
          {
            title: 'Share the guide',
            copy: 'Guests find times and useful information.',
          },
          {
            title: 'Welcome direct bookings',
            copy: 'Your website presents the property and stay extras.',
          },
        ],
        question: 'Does AI decide for me?',
        answer:
          'Explore approval rules in the agent demo. Allowed actions should match your configuration.',
      },
      {
        name: 'Riads & guesthouses',
        title: 'Rooms to prepare.\nA stay to discover.',
        copy: 'The journey starts with a room. It continues with breakfast, thoughtful services and your team’s advice.',
        steps: [
          {
            title: 'Choose a room',
            copy: 'The guest explores your site and selects a stay.',
          },
          {
            title: 'Add a service',
            copy: 'They discover services offered with their booking.',
          },
          {
            title: 'Prepare the arrival',
            copy: 'The guide brings together useful information on site.',
          },
        ],
        question: 'Can I present my own services?',
        answer:
          'The demos show an extras catalogue associated with a stay. Prices, availability and terms depend on your offer.',
      },
      {
        name: 'Multi-owner portfolios',
        title: 'A shared portfolio.\nClearly separated information.',
        copy: 'Each owner should understand their business without accessing other owners’ information.',
        steps: [
          {
            title: 'Track every property',
            copy: 'The calendar offers a portfolio overview.',
          },
          {
            title: 'Read a statement',
            copy: 'The portal presents the owner’s amounts and documents.',
          },
          {
            title: 'Control access',
            copy: 'Roles determine which information is visible.',
          },
        ],
        question: 'Do all owners see the same data?',
        answer:
          'The portal is presented with access limited to the owner’s scope. Check permissions during setup.',
      },
    ],
  },
  welcome: {
    eyebrow: 'Welcome guide & experiences',
    title: 'Your welcome,\nin their pocket.',
    intro:
      'The right information at the right moment: arrival, the home, your local recommendations and services that complete the stay.',
    demo: 'Follow the journey',
    contact: 'Discover Baitly',
    pricing: 'Explore plans',
    example: 'Demonstration guide · Fictional data',
    hello: 'Make yourself at home',
    property: 'Maison Zayna',
    location: 'Marrakech',
    arrival: 'Your arrival',
    arrivalCopy: 'From 3 pm · Check-out before 11 am',
    essentials: 'The essentials',
    wifi: 'Wi-Fi',
    access: 'Getting inside',
    accessCopy: 'Directions to find the house',
    extras: 'Complete your stay',
    hostTitle: 'You prepare.\nGuests discover.',
    hostCopy:
      'Edit this example and see the result on the phone. Everything stays within this demo.',
    host: 'Host view',
    guest: 'Guest view',
    steps: ['Your welcome', 'The essentials', 'Your extras'],
    welcomeLabel: 'Your welcome message',
    defaultWelcome:
      'Welcome to Maison Zayna. Make yourself at home. We have collected our tips here to help you enjoy your stay.',
    wifiLabel: 'Show Wi-Fi information',
    arrivalLabel: 'Show arrival and departure times',
    extrasLabel: 'Choose services to display',
    extraNames: ['Breakfast in the courtyard', 'Late check-out'],
    extraCopy: ['A lovely start to the day', 'Enjoy the house a little longer'],
    previewEmpty: 'Your service selection will appear here.',
    saved: 'Preview updated',
    pause: 'Pause',
    play: 'Resume demo',
    note: 'Illustrative prices in euros. No actual booking or publication.',
    journeyTitle: 'Before, during and around the stay.',
    journey: [
      {
        title: 'Prepare the arrival',
        copy: 'Collect the address, times and useful instructions.',
      },
      {
        title: 'Find the essentials',
        copy: 'Guests open the guide from a link, without installing an app.',
      },
      {
        title: 'Discover your services',
        copy: 'Present extras and experiences with their terms.',
      },
    ],
    catalogTitle: 'Your services.\nClear terms.',
    catalogCaption: 'Local cuisine to discover during the stay',
    catalogCopy:
      'Build your selection: breakfast, late check-out, transfers or activities. Partner offers depend on the connections and catalogue available at launch.',
    catalogNote:
      'Catalogue examples are not a list of activated partners. Fees and terms must be confirmed before subscribing.',
    bookingLink: 'See booking engine extras too',
    faqTitle: 'Before creating your guide',
    faq: [
      {
        q: 'Do guests need to install an app?',
        a: 'The presented journey opens from a web link. It is designed for phones.',
      },
      {
        q: 'Does this demo publish a real guide?',
        a: 'No. This journey illustrates arrival and the guest guide with fictional data. It does not publish anything or submit any registration.',
      },
      {
        q: 'Will every service be available at launch?',
        a: 'The catalogue, connections and sales terms will be specified for your plan and market.',
      },
    ],
    closing: 'Create a welcome that feels like you.',
    closingCopy:
      'Explore the journey, then discover a plan suited to your business.',
  },
};
const ar: JourneyMessages = {
  solutions: {
    eyebrow: 'حلول بايتلي',
    title: 'نشاطك يحدّد\nإيقاع العمل.',
    intro:
      'يختلف يوم المضيف عن يوم شركة الإدارة ودار الضيافة. استكشف المسار الأقرب إلى عملك.',
    choose: 'نشاطك',
    demo: 'سيناريوهات توضيحية · بيانات افتراضية',
    modules: 'وحدات للاستكشاف',
    scenario: 'يوم عمل، كمثال',
    pricing: 'اختيار باقتي',
    countriesTitle: 'نشاطك هنا.\nوسياقك المحلي أيضاً.',
    countriesCopy:
      'تختلف الإجراءات وطرق الدفع في الأسواق التي يعرضها بايتلي. تحقّق من النطاق المتاح عند الإطلاق لمنشأتك.',
    guide: 'قراءة دليل الالتزامات',
    countries: [
      {
        name: 'المغرب',
        copy: 'تحضير معلومات النزلاء وإجراءات المنشأة والتحصيل بالدرهم.',
      },
      {
        name: 'السعودية',
        copy: 'تحديد الإجراءات المحلية ومتطلبات الاتصال قبل إعداد المنتج.',
      },
      {
        name: 'فرنسا',
        copy: 'استكشاف إجراءات الإيجار السياحي وتحضير معلومات الفوترة باليورو.',
      },
    ],
    closingTitle: 'ابدأ من عملك اليومي.',
    closingCopy: 'استكشف العروض وقدّر اشتراكك وجهّز انتقالك.',
    migration: 'تحضير الانتقال',
    stories: [
      {
        name: 'شركات الإدارة',
        title: 'وصول يحتاج إلى تنسيق.\nوفريق على اطلاع.',
        copy: 'عندما تتزامن المغادرات والتنظيف والوصول، يحتاج كل متدخل إلى معرفة مهمته.',
        steps: [
          {
            title: 'يصل الحجز',
            copy: 'يجمع التقويم معلومات الإقامة والوحدة.',
          },
          {
            title: 'يتولى الفريق المهمة',
            copy: 'ترافق التعليمات والصور التدخل.',
          },
          {
            title: 'يتابع المالك وحدته',
            copy: 'تجمع بوابته المعلومات التي تخصه.',
          },
        ],
        question: 'هل أحتفظ بالتحكم في العمليات؟',
        answer:
          'تعرض النماذج خطوات المتابعة والاعتماد. تُحدّد الأدوار أثناء الإعداد.',
      },
      {
        name: 'المضيفون المستقلون',
        title: 'رسائل متكررة أقل.\nووقت أكبر للترحيب.',
        copy: 'سؤال عن الوصول وحجز للتأكيد وخدمة للاقتراح: تابع مسار الإقامة.',
        steps: [
          {
            title: 'تحضير الرد',
            copy: 'يقترح الوكيل رسالة لمراجعتها.',
          },
          {
            title: 'مشاركة الدليل',
            copy: 'يجد النزيل المواعيد والمعلومات المفيدة.',
          },
          {
            title: 'استقبال الحجوزات المباشرة',
            copy: 'يعرض موقعك الوحدة والخدمات الإضافية.',
          },
        ],
        question: 'هل يقرّر الذكاء الاصطناعي بدلاً مني؟',
        answer:
          'استكشف قواعد الموافقة في عرض الوكلاء. يجب أن تتوافق الإجراءات المسموحة مع إعداداتك.',
      },
      {
        name: 'الرياض التقليدية ودور الضيافة',
        title: 'غرف للتحضير.\nوإقامة للاكتشاف.',
        copy: 'تبدأ الرحلة بغرفة، ثم تستمر بالفطور والخدمات ونصائح فريقك.',
        steps: [
          {
            title: 'اختيار الغرفة',
            copy: 'يستكشف النزيل موقعك ويختار إقامته.',
          },
          {
            title: 'إضافة خدمة',
            copy: 'يكتشف الخدمات المقترحة مع الحجز.',
          },
          {
            title: 'تحضير الوصول',
            copy: 'يجمع الدليل المعلومات المفيدة في الموقع.',
          },
        ],
        question: 'هل يمكنني عرض خدماتي؟',
        answer:
          'تعرض النماذج كتالوج إضافات مرتبطاً بالإقامة. تتبع الأسعار والتوفّر والشروط عرضك.',
      },
      {
        name: 'محافظ متعددة الملّاك',
        title: 'محفظة مشتركة.\nومعلومات منفصلة بوضوح.',
        copy: 'يفهم كل مالك نشاطه دون الوصول إلى معلومات الملّاك الآخرين.',
        steps: [
          {
            title: 'متابعة كل وحدة',
            copy: 'يعرض التقويم نظرة عامة على المحفظة.',
          },
          {
            title: 'قراءة الكشف',
            copy: 'تعرض البوابة مبالغ المالك ووثائقه.',
          },
          {
            title: 'ضبط الوصول',
            copy: 'تحدّد الأدوار المعلومات المرئية.',
          },
        ],
        question: 'هل يرى كل الملّاك البيانات نفسها؟',
        answer:
          'تُعرض البوابة بوصول محدود بنطاق المالك. تحقّق من الصلاحيات أثناء الإعداد.',
      },
    ],
  },
  welcome: {
    eyebrow: 'دليل الترحيب والتجارب',
    title: 'ترحيبك،\nفي جيوبهم.',
    intro:
      'المعلومة المناسبة في الوقت المناسب: الوصول والمنزل وعناوينك المحلية والخدمات التي تكمل الإقامة.',
    demo: 'متابعة الرحلة',
    contact: 'اكتشاف بايتلي',
    pricing: 'اكتشاف الباقات',
    example: 'دليل توضيحي · بيانات افتراضية',
    hello: 'أهلاً بكم في منزلكم',
    property: 'دار زينة',
    location: 'مراكش',
    arrival: 'وصولكم',
    arrivalCopy: 'من 15:00 · المغادرة قبل 11:00',
    essentials: 'الأساسيات',
    wifi: 'الواي فاي',
    access: 'الدخول إلى الوحدة',
    accessCopy: 'تعليمات الوصول إلى المنزل',
    extras: 'لإكمال إقامتكم',
    hostTitle: 'أنت تُحضّر.\nوالنزيل يكتشف.',
    hostCopy:
      'عدّل هذا المثال وشاهد النتيجة على الهاتف. كل شيء يبقى داخل العرض التوضيحي.',
    host: 'جانب المضيف',
    guest: 'جانب النزيل',
    steps: ['ترحيبك', 'الأساسيات', 'إضافاتك'],
    welcomeLabel: 'رسالة الترحيب',
    defaultWelcome:
      'أهلاً بكم في دار زينة. استريحوا، جمعنا هنا نصائحنا للاستمتاع بإقامتكم.',
    wifiLabel: 'إظهار معلومات الواي فاي',
    arrivalLabel: 'إظهار مواعيد الوصول والمغادرة',
    extrasLabel: 'اختيار الخدمات المعروضة',
    extraNames: ['فطور في الفناء', 'مغادرة متأخرة'],
    extraCopy: ['لبداية يوم جميلة', 'استمتع بالمنزل لوقت أطول'],
    previewEmpty: 'ستظهر هنا الخدمات التي تختارها.',
    saved: 'تم تحديث المعاينة',
    pause: 'إيقاف مؤقت',
    play: 'استئناف العرض',
    note: 'أسعار توضيحية باليورو. لا حجز أو نشر فعلي.',
    journeyTitle: 'قبل الإقامة وخلالها ومن حولها.',
    journey: [
      {
        title: 'تحضير الوصول',
        copy: 'اجمع العنوان والمواعيد والتعليمات المفيدة.',
      },
      {
        title: 'العثور على الأساسيات',
        copy: 'يفتح النزيل الدليل من رابط دون تثبيت تطبيق.',
      },
      {
        title: 'اكتشاف خدماتك',
        copy: 'اعرض الإضافات والتجارب مع شروطها.',
      },
    ],
    catalogTitle: 'خدماتك.\nوشروط واضحة.',
    catalogCaption: 'مأكولات محلية لاكتشافها أثناء الإقامة',
    catalogCopy:
      'كوّن اختيارك: فطور أو مغادرة متأخرة أو نقل أو نشاط. تتبع عروض الشركاء الاتصالات والكتالوج المتاح عند الإطلاق.',
    catalogNote:
      'أمثلة الكتالوج ليست قائمة شركاء مفعّلين. يجب تأكيد الرسوم والشروط قبل الاشتراك.',
    bookingLink: 'اكتشف أيضاً إضافات محرك الحجز',
    faqTitle: 'قبل تكوين دليلك',
    faq: [
      {
        q: 'هل يحتاج النزيل إلى تثبيت تطبيق؟',
        a: 'يُفتح المسار المعروض من رابط ويب وهو مصمّم للهاتف.',
      },
      {
        q: 'هل ينشر هذا العرض دليلاً حقيقياً؟',
        a: 'لا. يوضّح المسار الوصول وتصفّح الدليل ببيانات افتراضية. لا ينشر أي محتوى ولا يرسل أي تصريح.',
      },
      {
        q: 'هل تتوفّر كل الخدمات عند الإطلاق؟',
        a: 'سيُحدّد الكتالوج والاتصالات وشروط البيع حسب باقتك وسوقك.',
      },
    ],
    closing: 'حضّر ترحيباً يعكس هويتك.',
    closingCopy: 'استكشف المسار ثم اكتشف الباقة المناسبة لنشاطك.',
  },
};
export const BAITLY_JOURNEY_MESSAGES: Record<SiteLanguage, JourneyMessages> = {
  fr,
  en,
  ar,
};
