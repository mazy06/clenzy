import type { BaitlyAlternative } from '../../data/baitlyAlternatives';
import type { SiteLanguage } from '../siteLanguage';

interface AlternativeCopy {
  title: string;
  intro: string;
  /** Only what the vendor itself publishes on its pricing page. */
  facts: ReadonlyArray<string>;
  faq: ReadonlyArray<{ q: string; a: string }>;
}

interface AlternativeMessages {
  eyebrow: string;
  /** `{name}` is replaced by the vendor name. */
  publishedTitle: string;
  publishedCopy: string;
  source: string;
  checked: string;
  baitlyTitle: string;
  baitlyCopy: string;
  baitlyPoints: ReadonlyArray<{ title: string; copy: string }>;
  questionsTitle: string;
  questionsCopy: string;
  questions: ReadonlyArray<string>;
  note: string;
  faqTitle: string;
  demo: string;
  pricing: string;
  migration: string;
  closingTitle: string;
  closingCopy: string;
  /** Links block on /comparer. */
  compareTitle: string;
  compareCopy: string;
  vendors: Record<BaitlyAlternative, AlternativeCopy>;
}

/**
 * Comparative pages. French law only allows comparisons that are objective
 * and verifiable: a competitor fact must come from its own pricing page
 * (`BAITLY_ALTERNATIVE_VENDORS`), and nothing here may claim that a
 * competitor lacks a feature. Differences are asked as questions instead.
 */
export const BAITLY_ALTERNATIVE_MESSAGES: Record<
  SiteLanguage,
  AlternativeMessages
> = {
  fr: {
    eyebrow: 'Alternative à',
    publishedTitle: 'Ce que {name} publie sur ses tarifs',
    publishedCopy:
      'Relevé sur la page tarifaire officielle de l’éditeur. Les offres évoluent : vérifiez-les avant de décider.',
    source: 'Page tarifaire officielle',
    checked: 'Relevé le 28 octobre 2026',
    baitlyTitle: 'Ce que propose Baitly',
    baitlyCopy:
      'Un PMS avec des agents IA, pensé pour les règles de la France, du Maroc et de l’Arabie saoudite.',
    baitlyPoints: [
      {
        title: 'Une grille publique, par logement',
        copy: 'Essentiel et Pro à partir de 29 € et 49 € HT par logement et par mois en Europe, en dirhams au Maroc et en riyals en Arabie saoudite, avec des remises de volume et de fidélité.',
      },
      {
        title: 'Vos canaux dans un seul calendrier',
        copy: 'Airbnb, Booking.com et vos réservations directes synchronisés, avec votre propre site de réservation directe.',
      },
      {
        title: 'Vos obligations locales documentées',
        copy: 'Fiche de police, taxe de séjour, enregistrement : des guides sourcés pour la France, le Maroc et l’Arabie saoudite.',
      },
      {
        title: 'Français, anglais et arabe',
        copy: 'L’interface et votre site de réservation en trois langues, l’arabe affiché de droite à gauche.',
      },
    ],
    questionsTitle: 'Les questions à poser à chaque éditeur',
    questionsCopy: 'Posez-les à {name} comme à nous avant de choisir.',
    questions: [
      'Quel est le prix total pour mon nombre de logements, frais de réservation et options compris ?',
      'L’interface et le site de réservation existent-ils en arabe ?',
      'La fiche de police et la taxe de séjour de mon pays sont-elles prises en charge ?',
      'Puis-je être facturé et encaisser dans ma devise : euro, dirham ou riyal ?',
      'Comment récupérer mes données si je change de logiciel ?',
    ],
    note: 'Baitly est en pré-lancement : sa grille est proposée pour le lancement et le périmètre disponible se vérifie avec nous en démo. Guesty, Lodgify, Smoobu et Hostaway sont des marques de leurs titulaires ; Baitly n’y est pas affilié.',
    faqTitle: 'Questions fréquentes',
    demo: 'Demander une démo',
    pricing: 'Simuler mon tarif',
    migration: 'Préparer ma migration',
    closingTitle: 'Comparez sur votre propre activité.',
    closingCopy:
      'Montrez-nous vos logements et vos canaux : nous comparons avec vous, sur vos chiffres.',
    compareTitle: 'Vous hésitez avec un outil précis ?',
    compareCopy:
      'Ce que chaque éditeur publie sur ses tarifs, face à l’offre de Baitly.',
    vendors: {
      guesty: {
        title: 'Une alternative à Guesty\npour la France, le Maroc et l’Arabie saoudite.',
        intro:
          'Vous comparez Guesty ? Voici ce que l’éditeur publie sur ses tarifs, ce que propose Baitly et les questions à poser pour choisir en connaissance de cause.',
        facts: [
          'Offre Lite pour 1 à 3 annonces, à partir de 9 $ par annonce et par mois, avec 14 jours d’essai.',
          'Offre Pro pour 4 à 199 annonces et offre Enterprise au-delà de 200 annonces : prix sur devis.',
          'Pas de frais en pourcentage sur les réservations de son moteur de réservation directe, hors frais du prestataire de paiement.',
        ],
        faq: [
          {
            q: 'Baitly est-il moins cher que Guesty ?',
            a: 'Guesty publie un prix pour son offre Lite (1 à 3 annonces) ; au-delà, il établit un devis. Demandez-le pour votre nombre de logements et comparez-le à la grille publique de Baitly, remises comprises.',
          },
          {
            q: 'Peut-on passer de Guesty à Baitly ?',
            a: 'Oui. Baitly lit vos données Guesty avec un connecteur en lecture seule, et vous vérifiez tout avant l’enregistrement. La page Migration détaille ce qui est repris.',
          },
        ],
      },
      lodgify: {
        title: 'Une alternative à Lodgify\npour la France, le Maroc et l’Arabie saoudite.',
        intro:
          'Vous comparez Lodgify ? Voici ce que l’éditeur publie sur ses tarifs, ce que propose Baitly et les questions à poser pour choisir en connaissance de cause.',
        facts: [
          'Quatre offres publiques, Basic, Starter, Professional et Ultimate, dont le prix dépend du nombre de logements.',
          '0 % de frais de réservation affiché sur les quatre offres, et 7 jours d’essai gratuit.',
          'Site de réservation directe inclus à partir de l’offre Starter.',
        ],
        faq: [
          {
            q: 'Les deux proposent-ils un site de réservation directe ?',
            a: 'Oui. Lodgify l’inclut à partir de son offre Starter ; chez Baitly, il fait partie de l’offre Essentiel. Comparez les deux sur le même nombre de logements.',
          },
          {
            q: 'Peut-on passer de Lodgify à Baitly ?',
            a: 'Oui, à partir d’un export de vos données. La page Migration explique quelles informations reprendre ; nous préparons la bascule avec vous en démo.',
          },
        ],
      },
      smoobu: {
        title: 'Une alternative à Smoobu\npour la France, le Maroc et l’Arabie saoudite.',
        intro:
          'Vous comparez Smoobu ? Voici ce que l’éditeur publie sur ses tarifs, ce que propose Baitly et les questions à poser pour choisir en connaissance de cause.',
        facts: [
          'Prix calculé selon le nombre de logements, avec 10 % de remise en paiement annuel et 20 % sur deux ans.',
          'Offre Professional Flex avec 0,9 % de commission par réservation ; les autres offres sont sans commission.',
          '14 jours d’essai gratuit, et devis personnalisé au-delà de 20 logements.',
        ],
        faq: [
          {
            q: 'Comment comparer le prix de Baitly et de Smoobu ?',
            a: 'Les deux facturent par logement. Comparez le total mensuel pour votre parc : remises annuelles chez Smoobu, remises de volume et de fidélité chez Baitly, simulables sur notre page Tarifs.',
          },
          {
            q: 'Peut-on passer de Smoobu à Baitly ?',
            a: 'Oui. Baitly lit vos données Smoobu avec un connecteur en lecture seule, et vous vérifiez tout avant l’enregistrement. La page Migration détaille ce qui est repris.',
          },
        ],
      },
      hostaway: {
        title: 'Une alternative à Hostaway\npour la France, le Maroc et l’Arabie saoudite.',
        intro:
          'Vous comparez Hostaway ? Voici ce que l’éditeur publie sur ses tarifs, ce que propose Baitly et les questions à poser pour choisir en connaissance de cause.',
        facts: [
          'Pas de prix public : la page tarifaire ouvre un formulaire de demande de devis.',
          'Le devis part du nombre de propriétés gérées, de 0-1 à plus de 200.',
        ],
        faq: [
          {
            q: 'Combien coûte Baitly par rapport à Hostaway ?',
            a: 'Hostaway communique ses prix sur devis. Baitly publie sa grille par logement sur sa page Tarifs : demandez un devis pour le même nombre de logements et comparez.',
          },
          {
            q: 'Peut-on passer d’Hostaway à Baitly ?',
            a: 'Oui. Baitly lit vos données Hostaway avec un connecteur en lecture seule, et vous vérifiez tout avant l’enregistrement. La page Migration détaille ce qui est repris.',
          },
        ],
      },
    },
  },
  en: {
    eyebrow: 'Alternative to',
    publishedTitle: 'What {name} publishes about its pricing',
    publishedCopy:
      'Taken from the vendor’s official pricing page. Plans change, so check them before you decide.',
    source: 'Official pricing page',
    checked: 'Checked on October 28, 2026',
    baitlyTitle: 'What Baitly offers',
    baitlyCopy:
      'A PMS with AI agents, built for the rules of France, Morocco and Saudi Arabia.',
    baitlyPoints: [
      {
        title: 'A public price per property',
        copy: 'Essential and Pro from €29 and €49 per property per month excl. VAT in Europe, in dirhams in Morocco and in riyals in Saudi Arabia, with volume and loyalty discounts.',
      },
      {
        title: 'Every channel in one calendar',
        copy: 'Airbnb, Booking.com and your direct bookings in sync, with your own direct booking website.',
      },
      {
        title: 'Your local obligations, documented',
        copy: 'Guest registration, tourist tax, licensing: sourced guides for France, Morocco and Saudi Arabia.',
      },
      {
        title: 'French, English and Arabic',
        copy: 'The interface and your booking website in three languages, with Arabic shown right to left.',
      },
    ],
    questionsTitle: 'Questions to ask every vendor',
    questionsCopy: 'Ask {name} the same questions as us before you choose.',
    questions: [
      'What is the total price for my number of properties, including booking fees and add-ons?',
      'Are the interface and the booking website available in Arabic?',
      'Are guest registration and tourist tax for my country covered?',
      'Can I be billed and get paid in my currency: euro, dirham or riyal?',
      'How do I get my data back if I switch software?',
    ],
    note: 'Baitly is in pre-launch: its pricing is proposed for launch, and we confirm the available scope with you in a demo. Guesty, Lodgify, Smoobu and Hostaway are trademarks of their respective owners; Baitly is not affiliated with them.',
    faqTitle: 'Frequently asked questions',
    demo: 'Request a demo',
    pricing: 'Estimate my price',
    migration: 'Plan my migration',
    closingTitle: 'Compare on your own business.',
    closingCopy:
      'Show us your properties and channels: we compare with you, on your numbers.',
    compareTitle: 'Weighing a specific tool?',
    compareCopy:
      'What each vendor publishes about its pricing, next to Baitly’s offer.',
    vendors: {
      guesty: {
        title: 'A Guesty alternative\nfor France, Morocco and Saudi Arabia.',
        intro:
          'Comparing Guesty? Here is what the vendor publishes about its pricing, what Baitly offers and the questions to ask before you choose.',
        facts: [
          'Lite plan for 1 to 3 listings, from $9 per listing per month, with a 14-day trial.',
          'Pro plan for 4 to 199 listings and Enterprise plan above 200 listings: price on quote.',
          'No percentage fees on reservations made through its direct booking engine, apart from payment processor fees.',
        ],
        faq: [
          {
            q: 'Is Baitly cheaper than Guesty?',
            a: 'Guesty publishes a price for its Lite plan (1 to 3 listings) and quotes above that. Ask for a quote for your number of properties and compare it with Baitly’s public pricing, discounts included.',
          },
          {
            q: 'Can I switch from Guesty to Baitly?',
            a: 'Yes. Baitly reads your Guesty data through a read-only connector, and you review everything before it is saved. The Migration page details what is transferred.',
          },
        ],
      },
      lodgify: {
        title: 'A Lodgify alternative\nfor France, Morocco and Saudi Arabia.',
        intro:
          'Comparing Lodgify? Here is what the vendor publishes about its pricing, what Baitly offers and the questions to ask before you choose.',
        facts: [
          'Four public plans, Basic, Starter, Professional and Ultimate, priced by number of properties.',
          '0% booking fee shown on all four plans, and a 7-day free trial.',
          'Direct booking website included from the Starter plan.',
        ],
        faq: [
          {
            q: 'Do both offer a direct booking website?',
            a: 'Yes. Lodgify includes it from its Starter plan; at Baitly it is part of the Essential plan. Compare both for the same number of properties.',
          },
          {
            q: 'Can I switch from Lodgify to Baitly?',
            a: 'Yes, from an export of your data. The Migration page explains which information to transfer, and we prepare the switch with you in a demo.',
          },
        ],
      },
      smoobu: {
        title: 'A Smoobu alternative\nfor France, Morocco and Saudi Arabia.',
        intro:
          'Comparing Smoobu? Here is what the vendor publishes about its pricing, what Baitly offers and the questions to ask before you choose.',
        facts: [
          'Price based on the number of units, with 10% off yearly billing and 20% off two-year billing.',
          'Professional Flex plan with a 0.9% fee per booking; the other plans are commission-free.',
          '14-day free trial, and a personalized quote above 20 properties.',
        ],
        faq: [
          {
            q: 'How do I compare Baitly and Smoobu prices?',
            a: 'Both charge per property. Compare the monthly total for your portfolio: yearly discounts at Smoobu, volume and loyalty discounts at Baitly, which you can estimate on our Pricing page.',
          },
          {
            q: 'Can I switch from Smoobu to Baitly?',
            a: 'Yes. Baitly reads your Smoobu data through a read-only connector, and you review everything before it is saved. The Migration page details what is transferred.',
          },
        ],
      },
      hostaway: {
        title: 'A Hostaway alternative\nfor France, Morocco and Saudi Arabia.',
        intro:
          'Comparing Hostaway? Here is what the vendor publishes about its pricing, what Baitly offers and the questions to ask before you choose.',
        facts: [
          'No public price: the pricing page opens a quote request form.',
          'The quote starts from the number of properties managed, from 0-1 to over 200.',
        ],
        faq: [
          {
            q: 'How much does Baitly cost compared with Hostaway?',
            a: 'Hostaway prices on quote. Baitly publishes its per-property pricing on its Pricing page: ask for a quote for the same number of properties and compare.',
          },
          {
            q: 'Can I switch from Hostaway to Baitly?',
            a: 'Yes. Baitly reads your Hostaway data through a read-only connector, and you review everything before it is saved. The Migration page details what is transferred.',
          },
        ],
      },
    },
  },
  ar: {
    eyebrow: 'بديل لـ',
    publishedTitle: 'ما تنشره {name} عن أسعارها',
    publishedCopy:
      'منقول من صفحة الأسعار الرسمية للشركة. العروض تتغير، فتحقق منها قبل أن تقرر.',
    source: 'صفحة الأسعار الرسمية',
    checked: 'تم التحقق في 28 أكتوبر 2026',
    baitlyTitle: 'ما يقدّمه بيتلي',
    baitlyCopy:
      'نظام إدارة عقارات مع وكلاء ذكاء اصطناعي، مصمَّم لقواعد فرنسا والمغرب والسعودية.',
    baitlyPoints: [
      {
        title: 'سعر معلن لكل وحدة',
        copy: 'باقتا الأساسية والمتقدّمة ابتداءً من 109 و189 ريالاً لكل وحدة شهرياً دون ضريبة في السعودية، وبالدرهم في المغرب وباليورو في أوروبا، مع خصومات حسب عدد الوحدات ومدة الاشتراك.',
      },
      {
        title: 'كل قنواتك في تقويم واحد',
        copy: 'Airbnb وBooking.com وحجوزاتك المباشرة متزامنة، مع موقع حجز مباشر خاص بك.',
      },
      {
        title: 'التزاماتك المحلية موثّقة',
        copy: 'تسجيل الضيوف وضريبة الإقامة والترخيص: أدلة موثّقة المصادر لفرنسا والمغرب والسعودية.',
      },
      {
        title: 'العربية والفرنسية والإنجليزية',
        copy: 'الواجهة وموقع الحجز بثلاث لغات، والعربية من اليمين إلى اليسار.',
      },
    ],
    questionsTitle: 'أسئلة تطرحها على كل شركة',
    questionsCopy: 'اطرحها على {name} كما تطرحها علينا قبل أن تختار.',
    questions: [
      'ما السعر الإجمالي لعدد وحداتي، شاملاً رسوم الحجز والخيارات الإضافية؟',
      'هل الواجهة وموقع الحجز متوفران بالعربية؟',
      'هل يغطي النظام تسجيل الضيوف وضريبة الإقامة في بلدي؟',
      'هل يمكنني الدفع والتحصيل بعملتي: اليورو أو الدرهم أو الريال؟',
      'كيف أستعيد بياناتي إذا غيّرت النظام؟',
    ],
    note: 'بيتلي في مرحلة ما قبل الإطلاق: أسعاره مقترحة للإطلاق، ونؤكد معك النطاق المتاح خلال العرض التوضيحي. Guesty وLodgify وSmoobu وHostaway علامات تجارية لأصحابها، ولا ينتمي بيتلي إليها.',
    faqTitle: 'أسئلة شائعة',
    demo: 'اطلب عرضاً توضيحياً',
    pricing: 'احسب سعري',
    migration: 'جهّز انتقالي',
    closingTitle: 'قارن على أساس نشاطك أنت.',
    closingCopy: 'أرِنا وحداتك وقنواتك: نقارن معك، بأرقامك.',
    compareTitle: 'تتردد بين بيتلي وأداة محددة؟',
    compareCopy: 'ما تنشره كل شركة عن أسعارها، مقابل ما يقدّمه بيتلي.',
    vendors: {
      guesty: {
        title: 'بديل لـ Guesty\nلفرنسا والمغرب والسعودية.',
        intro:
          'تقارن Guesty؟ إليك ما تنشره الشركة عن أسعارها، وما يقدّمه بيتلي، والأسئلة التي تطرحها قبل أن تختار.',
        facts: [
          'باقة Lite من 1 إلى 3 إعلانات، ابتداءً من 9 دولارات لكل إعلان شهرياً، مع تجربة 14 يوماً.',
          'باقة Pro من 4 إلى 199 إعلاناً وباقة Enterprise لأكثر من 200 إعلان: السعر بعرض مخصّص.',
          'لا رسوم بنسبة مئوية على الحجوزات عبر محرك الحجز المباشر لديها، باستثناء رسوم مزوّد الدفع.',
        ],
        faq: [
          {
            q: 'هل بيتلي أرخص من Guesty؟',
            a: 'تنشر Guesty سعر باقة Lite (من 1 إلى 3 إعلانات) وتقدّم عرض سعر لما يزيد عن ذلك. اطلبه لعدد وحداتك وقارنه بأسعار بيتلي المعلنة شاملة الخصومات.',
          },
          {
            q: 'هل يمكن الانتقال من Guesty إلى بيتلي؟',
            a: 'نعم. يقرأ بيتلي بيانات Guesty عبر موصل للقراءة فقط، وتراجع كل شيء قبل الحفظ. تشرح صفحة الانتقال ما يُنقل.',
          },
        ],
      },
      lodgify: {
        title: 'بديل لـ Lodgify\nلفرنسا والمغرب والسعودية.',
        intro:
          'تقارن Lodgify؟ إليك ما تنشره الشركة عن أسعارها، وما يقدّمه بيتلي، والأسئلة التي تطرحها قبل أن تختار.',
        facts: [
          'أربع باقات معلنة، Basic وStarter وProfessional وUltimate، يتوقف سعرها على عدد الوحدات.',
          'رسوم حجز 0٪ معلنة في الباقات الأربع، وتجربة مجانية لمدة 7 أيام.',
          'موقع الحجز المباشر مشمول ابتداءً من باقة Starter.',
        ],
        faq: [
          {
            q: 'هل يقدّم الاثنان موقعاً للحجز المباشر؟',
            a: 'نعم. تشمله Lodgify ابتداءً من باقة Starter، وفي بيتلي هو جزء من الباقة الأساسية. قارن بينهما لعدد الوحدات نفسه.',
          },
          {
            q: 'هل يمكن الانتقال من Lodgify إلى بيتلي؟',
            a: 'نعم، انطلاقاً من تصدير بياناتك. تشرح صفحة الانتقال المعلومات التي تُنقل، ونجهّز الانتقال معك خلال العرض التوضيحي.',
          },
        ],
      },
      smoobu: {
        title: 'بديل لـ Smoobu\nلفرنسا والمغرب والسعودية.',
        intro:
          'تقارن Smoobu؟ إليك ما تنشره الشركة عن أسعارها، وما يقدّمه بيتلي، والأسئلة التي تطرحها قبل أن تختار.',
        facts: [
          'سعر يُحسب حسب عدد الوحدات، مع خصم 10٪ للدفع السنوي و20٪ لسنتين.',
          'باقة Professional Flex بعمولة 0.9٪ على كل حجز، والباقات الأخرى دون عمولة.',
          'تجربة مجانية لمدة 14 يوماً، وعرض سعر مخصّص لأكثر من 20 وحدة.',
        ],
        faq: [
          {
            q: 'كيف أقارن أسعار بيتلي وSmoobu؟',
            a: 'كلاهما يحتسب السعر لكل وحدة. قارن الإجمالي الشهري لعدد وحداتك: خصومات سنوية لدى Smoobu، وخصومات حسب العدد والمدة لدى بيتلي يمكنك حسابها في صفحة الأسعار.',
          },
          {
            q: 'هل يمكن الانتقال من Smoobu إلى بيتلي؟',
            a: 'نعم. يقرأ بيتلي بيانات Smoobu عبر موصل للقراءة فقط، وتراجع كل شيء قبل الحفظ. تشرح صفحة الانتقال ما يُنقل.',
          },
        ],
      },
      hostaway: {
        title: 'بديل لـ Hostaway\nلفرنسا والمغرب والسعودية.',
        intro:
          'تقارن Hostaway؟ إليك ما تنشره الشركة عن أسعارها، وما يقدّمه بيتلي، والأسئلة التي تطرحها قبل أن تختار.',
        facts: [
          'لا سعر معلن: تفتح صفحة الأسعار نموذجاً لطلب عرض سعر.',
          'يبدأ عرض السعر بعدد العقارات المُدارة، من 0-1 إلى أكثر من 200.',
        ],
        faq: [
          {
            q: 'كم يكلّف بيتلي مقارنة بـ Hostaway؟',
            a: 'تحدّد Hostaway أسعارها بعرض مخصّص. ينشر بيتلي سعره لكل وحدة في صفحة الأسعار: اطلب عرض سعر لعدد الوحدات نفسه وقارن.',
          },
          {
            q: 'هل يمكن الانتقال من Hostaway إلى بيتلي؟',
            a: 'نعم. يقرأ بيتلي بيانات Hostaway عبر موصل للقراءة فقط، وتراجع كل شيء قبل الحفظ. تشرح صفحة الانتقال ما يُنقل.',
          },
        ],
      },
    },
  },
};
