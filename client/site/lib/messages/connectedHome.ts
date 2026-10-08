import type { SiteLanguage } from '../siteLanguage';

export type ConnectedHomeScenario = 'access' | 'noise' | 'entrance';
type Scenario = {
  label: string;
  device: string;
  location: string;
  title: string;
  problem: string;
  steps: [string, string, string];
  benefit: string;
  boundary: string;
};
type Messages = {
  eyebrow: string;
  title: string;
  intro: string;
  choose: string;
  illustration: string;
  illustrationAlt: string;
  problemLabel: string;
  response: string;
  benefitLabel: string;
  compatibility: string;
  rulesTitle: string;
  rules: [string, string, string];
  sources: string;
  sourceNames: [string, string, string];
  scenarios: Record<ConnectedHomeScenario, Scenario>;
};

const fr: Messages = {
  eyebrow: 'Un équipement, une réponse concrète',
  title: 'Accueillir sereinement. Protéger ce qui compte.',
  intro: 'Une arrivée tardive, une soirée trop bruyante, un doute sur les accès. Reliez vos équipements au séjour et donnez une suite utile à chaque situation dans Baitly.',
  choose: 'Quelle situation souhaitez-vous anticiper ?',
  illustration: 'Explorez les équipements du logement',
  illustrationAlt: 'Logement illustré avec une serrure à code, un capteur de bruit dans le salon et une caméra orientée vers le porche extérieur privé.',
  problemLabel: 'Ce que vous voulez éviter',
  response: 'La réponse dans Baitly',
  benefitLabel: 'Pour vous, propriétaire',
  compatibility: 'Les fonctions dépendent du modèle compatible, de sa connexion et des règles activées. Votre gestionnaire garde la main sur les situations qui demandent une décision.',
  rulesTitle: 'Protéger le logement, respecter les voyageurs',
  rules: [
    'L’installation d’une serrure reste soumise aux règles du bâtiment. Les boîtes à clés sur le mobilier urbain sont interdites dans certaines communes, notamment Paris : vérifiez les règles locales.',
    'Un sonomètre mesure un niveau sonore, sans enregistrer les conversations. Sur Airbnb, sa présence doit être déclarée ; il ne doit pas être installé dans une chambre, une salle de bain ou un espace de couchage.',
    'Pour les logements Airbnb, les caméras intérieures sont interdites. Une caméra extérieure doit être déclarée et respecter la vie privée. En France, un particulier ne peut pas filmer la voie publique ou ses voisins. Vérifiez aussi la législation du pays et les règles de votre canal de réservation.',
  ],
  sources: 'Repères pour votre installation',
  sourceNames: ['Boîtes à clés · Ville de Paris', 'Caméras et sonomètres · Airbnb', 'Caméras chez soi · CNIL'],
  scenarios: {
    access: {
      label: 'Accueillir sans attendre', device: 'Serrure connectée', location: 'Porte d’entrée',
      title: 'L’arrivée ne devrait pas dépendre de votre disponibilité.',
      problem: 'Retard du voyageur, remise de clés à organiser, double perdu ou boîte à clés interdite sur le mobilier urbain : chaque arrivée peut devenir une contrainte.',
      steps: ['Baitly prépare un code individuel lié aux dates du séjour.', 'Les consignes et l’accès sont transmis au voyageur par le canal configuré.', 'Le code expire à la fin du créneau. Son historique reste consultable.'],
      benefit: 'Des arrivées autonomes et des accès limités dans le temps, sans organiser chaque remise de clés.',
      boundary: 'Prévoir une solution de secours en cas de batterie faible ou d’indisponibilité de l’équipement.',
    },
    noise: {
      label: 'Préserver le voisinage', device: 'Capteur de bruit', location: 'Salon',
      title: 'Agir avant que le bruit ne devienne un conflit.',
      problem: 'Fête improvisée, musique tardive, heures de repos non respectées : les voisins subissent les nuisances avant que vous en soyez informé.',
      steps: ['Vous réglez les seuils sonores et les plages horaires dans Baitly.', 'Un dépassement crée une alerte et peut déclencher un rappel au voyageur par WhatsApp ou email.', 'Le gestionnaire est prévenu selon vos règles et suit le traitement de l’alerte.'],
      benefit: 'Un rappel au bon moment, un gestionnaire informé et un historique pour suivre les incidents.',
      boundary: 'Des décibels, pas des conversations. Un dépassement est un signal à examiner, pas une preuve d’infraction.',
    },
    entrance: {
      label: 'Vérifier les accès', device: 'Caméra extérieure', location: 'Entrée privée',
      title: 'Lever un doute sur l’entrée du logement.',
      problem: 'Visiteurs non prévus, accès non autorisé ou incident signalé : vous avez besoin de comprendre la situation et de vérifier le respect des conditions du séjour.',
      steps: ['La caméra compatible est rattachée au logement dans Baitly.', 'Le gestionnaire autorisé consulte le flux de l’entrée extérieure pour vérifier un signalement.', 'Il rapproche ses observations de la réservation puis contacte le voyageur si nécessaire.'],
      benefit: 'Une vérification visuelle au même endroit que le dossier du séjour, pour décider sur des faits.',
      boundary: 'Vérification humaine : pas de comptage certifié des occupants, de reconnaissance faciale ni de détection automatique d’activités illégales.',
    },
  },
};

const en: Messages = {
  eyebrow: 'A device with a clear purpose',
  title: 'Welcome with confidence. Protect what matters.',
  intro: 'A late arrival, a noisy evening, a concern about access. Connect your devices to the stay and respond to each situation in Baitly.',
  choose: 'Which situation would you like to plan for?',
  illustration: 'Explore the property’s devices',
  illustrationAlt: 'Illustrated home with a keypad lock, a living-room noise sensor and a camera facing the private exterior porch.',
  problemLabel: 'What you want to avoid', response: 'The response in Baitly', benefitLabel: 'For you, the owner',
  compatibility: 'Features depend on the compatible model, its connection and your enabled rules. Your manager remains in control of situations that need a decision.',
  rulesTitle: 'Protect the property. Respect your guests.',
  rules: [
    'Installing a lock remains subject to building rules. Key safes attached to street furniture are prohibited in some cities, including Paris. Check local rules.',
    'A noise monitor measures sound levels without recording conversations. Airbnb requires disclosure and prohibits monitors in bedrooms, bathrooms and sleeping areas.',
    'Airbnb prohibits indoor cameras in homes. Exterior cameras must be disclosed and respect privacy. In France, individuals cannot film public roads or their neighbours. Check local law and your booking channel’s rules too.',
  ],
  sources: 'Guidance for your installation',
  sourceNames: ['Key safes · City of Paris', 'Cameras and noise monitors · Airbnb', 'Home cameras · CNIL'],
  scenarios: {
    access: {
      label: 'Welcome without waiting', device: 'Smart lock', location: 'Front door',
      title: 'Check-in should not depend on your availability.',
      problem: 'A delayed guest, a key handover to arrange, a lost spare or a key safe banned on street furniture: every arrival can become a constraint.',
      steps: ['Baitly prepares an individual code linked to the stay dates.', 'Instructions and access details reach the guest through your configured channel.', 'The code expires at the end of its time window. Its history remains available.'],
      benefit: 'Independent arrivals and time-limited access, without arranging every key handover.',
      boundary: 'Keep a backup access option for low batteries or unavailable equipment.',
    },
    noise: {
      label: 'Respect the neighbourhood', device: 'Noise monitor', location: 'Living room',
      title: 'Act before noise turns into a dispute.',
      problem: 'An unplanned party, late music or ignored quiet hours: neighbours experience the disruption before you hear about it.',
      steps: ['Set sound thresholds and time windows in Baitly.', 'An exceeded threshold creates an alert and can trigger a guest reminder by WhatsApp or email.', 'Your manager is notified according to your rules and follows up on the alert.'],
      benefit: 'A timely reminder, an informed manager and a history to follow up on incidents.',
      boundary: 'Decibels, not conversations. A threshold breach is a signal to review, not proof of an offence.',
    },
    entrance: {
      label: 'Check property access', device: 'Exterior camera', location: 'Private entrance',
      title: 'Check a concern at the property entrance.',
      problem: 'Unexpected visitors, unauthorised access or a reported incident: you need to understand the situation and check the stay conditions are respected.',
      steps: ['Link a compatible camera to the property in Baitly.', 'An authorised manager views the exterior entrance feed to check a reported concern.', 'They compare their observations with the booking and contact the guest if needed.'],
      benefit: 'A visual check alongside the stay record, so you can decide based on facts.',
      boundary: 'Human review: no certified occupancy count, facial recognition or automatic detection of illegal activity.',
    },
  },
};

const ar: Messages = {
  eyebrow: 'جهاز يستجيب لحاجة واضحة',
  title: 'استقبال مطمئن. وحماية لما يهمك.',
  intro: 'وصول متأخر، سهرة صاخبة أو تساؤل حول الدخول. اربط أجهزتك بالإقامة وتعامل مع كل موقف من داخل بيتلي.',
  choose: 'أي موقف ترغب في الاستعداد له؟',
  illustration: 'استكشف أجهزة الوحدة',
  illustrationAlt: 'منزل توضيحي بقفل ذي رمز ومستشعر ضوضاء في غرفة الجلوس وكاميرا موجهة نحو المدخل الخارجي الخاص.',
  problemLabel: 'ما ترغب في تجنبه', response: 'الحل داخل بيتلي', benefitLabel: 'لك بصفتك المالك',
  compatibility: 'تعتمد الوظائف على طراز الجهاز المتوافق واتصاله والقواعد المفعلة. ويظل المدير مسؤولاً عن المواقف التي تتطلب اتخاذ قرار.',
  rulesTitle: 'حماية الوحدة مع احترام خصوصية الضيوف',
  rules: [
    'يخضع تركيب القفل لقواعد المبنى. وتحظر بعض المدن، ومنها باريس، تثبيت صناديق المفاتيح على تجهيزات الشارع. تحقق من القواعد المحلية.',
    'يقيس مستشعر الضوضاء مستوى الصوت دون تسجيل المحادثات. تشترط Airbnb الإفصاح عن وجوده وتحظر وضعه في غرف النوم والحمامات وأماكن النوم.',
    'تحظر Airbnb الكاميرات الداخلية في المساكن. يجب الإفصاح عن الكاميرات الخارجية واحترام الخصوصية. وفي فرنسا، لا يجوز للأفراد تصوير الطريق العام أو الجيران. تحقق أيضاً من قانون البلد وقواعد منصة الحجز.',
  ],
  sources: 'مراجع لتركيب أجهزتك',
  sourceNames: ['صناديق المفاتيح · بلدية باريس', 'الكاميرات ومستشعرات الضوضاء · Airbnb', 'الكاميرات المنزلية · CNIL'],
  scenarios: {
    access: {
      label: 'استقبال دون انتظار', device: 'قفل ذكي', location: 'باب المدخل',
      title: 'لا ينبغي أن يتوقف الوصول على تفرغك.',
      problem: 'تأخر الضيف، تنسيق تسليم المفاتيح، ضياع نسخة أو حظر صندوق المفاتيح في الشارع: قد يصبح كل وصول عبئاً إضافياً.',
      steps: ['يجهز بيتلي رمزاً فردياً مرتبطاً بتواريخ الإقامة.', 'تصل تعليمات الدخول إلى الضيف عبر القناة التي حددتها.', 'تنتهي صلاحية الرمز بنهاية الفترة المحددة، ويبقى سجله متاحاً.'],
      benefit: 'وصول مستقل وصلاحية دخول محددة زمنياً، دون تنسيق كل عملية تسليم مفاتيح.',
      boundary: 'احتفظ بخيار دخول احتياطي عند ضعف البطارية أو تعذر تشغيل الجهاز.',
    },
    noise: {
      label: 'الحفاظ على راحة الجيران', device: 'مستشعر ضوضاء', location: 'غرفة الجلوس',
      title: 'تدخل قبل أن تتحول الضوضاء إلى خلاف.',
      problem: 'حفلة غير متوقعة، موسيقى متأخرة أو تجاهل أوقات الراحة: يتأثر الجيران قبل أن يصلك الخبر.',
      steps: ['اضبط حدود مستوى الصوت والفترات الزمنية داخل بيتلي.', 'ينشئ تجاوز الحد تنبيهاً ويمكن أن يرسل تذكيراً للضيف عبر واتساب أو البريد الإلكتروني.', 'يُبلّغ المدير وفق قواعدك ويتابع معالجة التنبيه.'],
      benefit: 'تذكير في الوقت المناسب، ومدير مطلع، وسجل لمتابعة الحوادث.',
      boundary: 'قياس بالديسيبل دون تسجيل المحادثات. تجاوز الحد إشارة تستحق المراجعة وليس دليلاً على مخالفة.',
    },
    entrance: {
      label: 'التحقق من الدخول', device: 'كاميرا خارجية', location: 'مدخل خاص',
      title: 'التحقق من تساؤل حول مدخل الوحدة.',
      problem: 'زوار غير متوقعين، دخول غير مصرح به أو بلاغ عن حادث: تحتاج إلى فهم الموقف والتحقق من احترام شروط الإقامة.',
      steps: ['اربط الكاميرا المتوافقة بالوحدة داخل بيتلي.', 'يشاهد المدير المخول بث المدخل الخارجي للتحقق من البلاغ.', 'يقارن ملاحظاته بالحجز ويتواصل مع الضيف عند الحاجة.'],
      benefit: 'تحقق بصري بجانب ملف الإقامة، لاتخاذ قرار مبني على الوقائع.',
      boundary: 'مراجعة بشرية، دون إحصاء معتمد للشاغلين أو تعرف على الوجوه أو كشف آلي عن أنشطة غير قانونية.',
    },
  },
};

export const CONNECTED_HOME_MESSAGES: Record<SiteLanguage, Messages> = { fr, en, ar };
