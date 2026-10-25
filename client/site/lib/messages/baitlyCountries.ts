import type { BaitlyCountryPage } from '../../data/baitlyCountries';
import type { SiteLanguage } from '../siteLanguage';

interface CountryCopy {
  eyebrow: string;
  title: string;
  intro: string;
  pointsTitle: string;
  pointsCopy: string;
  points: ReadonlyArray<{ title: string; copy: string }>;
  rulesTitle: string;
  rulesCopy: string;
  faq: ReadonlyArray<{ q: string; a: string }>;
}

interface CountryMessages {
  demo: string;
  pricing: string;
  guide: string;
  read: string;
  faqTitle: string;
  note: string;
  closingTitle: string;
  closingCopy: string;
  countries: Record<BaitlyCountryPage, CountryCopy>;
}

/**
 * Country landing pages. Every claim mirrors the local scope already stated
 * on the home page (`home.local`): nothing here may promise a payment
 * provider, a connection or a filing that the product does not provide.
 */
export const BAITLY_COUNTRY_MESSAGES: Record<SiteLanguage, CountryMessages> = {
  fr: {
    demo: 'Demander une démo',
    pricing: 'Voir les tarifs',
    guide: 'Lire le guide complet des obligations',
    read: 'Lire l’article',
    faqTitle: 'Questions fréquentes',
    note: 'Baitly est en pré-lancement. Vérifiez avec nous le périmètre disponible pour votre établissement lors de la démo.',
    closingTitle: 'Votre activité, vos règles locales.',
    closingCopy:
      'Montrez-nous votre quotidien : nous partons de vos logements, de vos canaux et de vos démarches.',
    countries: {
      maroc: {
        eyebrow: 'Baitly au Maroc',
        title: 'Le logiciel de location saisonnière\npensé pour le Maroc.',
        intro:
          'Appartements, riads, maisons d’hôtes : centralisez vos réservations Airbnb, Booking.com et directes, préparez la fiche de police de vos voyageurs et suivez la taxe de séjour, en français, en arabe ou en anglais.',
        pointsTitle: 'Ce que Baitly prend en charge au Maroc',
        pointsCopy:
          'Un PMS et un channel manager qui connaissent vos démarches marocaines, sans tableur à côté.',
        points: [
          {
            title: 'Un calendrier pour tous vos canaux',
            copy: 'Airbnb, Booking.com et vos réservations directes synchronisés dans un seul planning pour limiter les doubles réservations.',
          },
          {
            title: 'Les informations voyageurs prêtes',
            copy: 'Les données d’identité nécessaires à la fiche de police au format DGSN sont réunies au fil de la réservation.',
          },
          {
            title: 'La taxe de séjour suivie',
            copy: 'La taxe de séjour se calcule par commune et reste distincte du prix du séjour dans vos comptes.',
          },
          {
            title: 'Vos montants en dirhams',
            copy: 'Tarifs, encaissements et relevés en dirhams. Les prestataires de paiement pour le Maroc sont en cours de sélection.',
          },
          {
            title: 'Votre site de réservation directe',
            copy: 'Un moteur de réservation à vos couleurs pour vendre sans commission, à côté des plateformes.',
          },
        ],
        rulesTitle: 'Les démarches de l’hébergement au Maroc',
        rulesCopy:
          'Autorisation, assurance, télédéclaration des voyageurs, taxe de séjour : nos articles détaillent chaque obligation, textes officiels à l’appui.',
        faq: [
          {
            q: 'Baitly convient-il à un riad ou à une maison d’hôtes ?',
            a: 'Oui. Baitly gère plusieurs chambres ou logements dans un même planning, avec les ménages, les arrivées et les paiements de chaque séjour.',
          },
          {
            q: 'Mes annonces Airbnb et Booking.com restent-elles en place ?',
            a: 'Oui. Baitly se connecte à vos annonces existantes et synchronise disponibilités, tarifs et réservations ; vous gardez vos avis et votre historique.',
          },
          {
            q: 'Baitly est-il disponible en arabe ?',
            a: 'Oui. Baitly fonctionne en français, en arabe avec lecture de droite à gauche, et en anglais.',
          },
        ],
      },
      'arabie-saoudite': {
        eyebrow: 'Baitly en Arabie saoudite',
        title: 'Le logiciel de gestion des unités\nde séjour privées en Arabie saoudite.',
        intro:
          'Appartements meublés, chalets, istirahas : gérez vos réservations, vos déclarations Shomoos et votre facturation conforme ZATCA, en arabe, avec le calendrier hégirien.',
        pointsTitle: 'Ce que Baitly prend en charge en Arabie saoudite',
        pointsCopy:
          'Un PMS et un channel manager construits pour le nouveau règlement des unités de séjour privées.',
        points: [
          {
            title: 'Les arrivées déclarées',
            copy: 'Les informations voyageurs sont préparées pour la déclaration Shomoos (شموس) à chaque arrivée.',
          },
          {
            title: 'Une facturation conforme',
            copy: 'TVA à 15 %, redevances municipales et facture au format ZATCA, calculées séjour par séjour.',
          },
          {
            title: 'L’arabe d’abord',
            copy: 'Interface en arabe avec lecture de droite à gauche, calendrier hégirien et montants en riyals.',
          },
          {
            title: 'Un calendrier pour tous vos canaux',
            copy: 'Vos réservations des plateformes et vos réservations directes réunies dans un seul planning.',
          },
          {
            title: 'Des paiements adaptés',
            copy: 'Les prestataires de paiement pour l’Arabie saoudite sont en cours de sélection, dans le respect des canaux autorisés par le règlement.',
          },
        ],
        rulesTitle: 'Le règlement des unités de séjour privées',
        rulesCopy:
          'Licence du ministère du Tourisme, Shomoos, durée de séjour, redevance municipale : nos articles détaillent le règlement publié le 11 septembre 2026.',
        faq: [
          {
            q: 'Faut-il une licence pour louer une unité privée ?',
            a: 'Oui. Depuis le règlement publié le 11 septembre 2026, l’exploitation d’une unité de séjour privée exige une licence valide du ministère du Tourisme. Notre article détaille les conditions.',
          },
          {
            q: 'Baitly gère-t-il le calendrier hégirien ?',
            a: 'Oui. Les dates s’affichent en calendrier hégirien ou grégorien, et l’interface arabe se lit de droite à gauche.',
          },
          {
            q: 'Baitly convient-il aux chalets et aux istirahas ?',
            a: 'Oui. Chaque unité dispose de son planning, de ses tarifs et de ses consignes d’arrivée.',
          },
        ],
      },
      france: {
        eyebrow: 'Baitly en France',
        title: 'Le logiciel de location saisonnière\net de conciergerie en France.',
        intro:
          'Meublés de tourisme, conciergeries, maisons d’hôtes : synchronisez Airbnb et Booking.com, suivez le plafond de 120 nuits, la taxe de séjour et la fiche de police, et facturez au format Factur-X.',
        pointsTitle: 'Ce que Baitly prend en charge en France',
        pointsCopy:
          'Un PMS et un channel manager qui tiennent les règles françaises de la location touristique.',
        points: [
          {
            title: 'Un calendrier pour tous vos canaux',
            copy: 'Airbnb, Booking.com et vos réservations directes synchronisés dans un seul planning.',
          },
          {
            title: 'Les règles de location tenues',
            copy: 'Numéro d’enregistrement en mairie et plafond de 120 nuits par an pour une résidence principale.',
          },
          {
            title: 'La taxe de séjour par commune',
            copy: 'Calculée selon le tarif de la commune et distinguée du prix du séjour.',
          },
          {
            title: 'Les voyageurs étrangers déclarés',
            copy: 'La fiche de police des voyageurs étrangers est préparée à l’arrivée.',
          },
          {
            title: 'Paiements et factures',
            copy: 'Encaissements par Stripe en euros et facture électronique Factur-X.',
          },
        ],
        rulesTitle: 'Les règles du meublé de tourisme en France',
        rulesCopy:
          'Enregistrement, 90 à 120 jours, changement d’usage, micro-BIC, taxe de séjour : nos articles détaillent chaque règle, textes officiels à l’appui.',
        faq: [
          {
            q: 'Baitly convient-il à une conciergerie ?',
            a: 'Oui. Baitly gère plusieurs propriétaires, leurs logements, les ménages et un portail propriétaire pour suivre les revenus.',
          },
          {
            q: 'Mes annonces Airbnb et Booking.com restent-elles en place ?',
            a: 'Oui. Baitly se connecte à vos annonces existantes ; vous gardez vos avis et votre historique.',
          },
          {
            q: 'Baitly suit-il la limite de 120 nuits ?',
            a: 'Oui, pour une résidence principale. Le plafond dépend de la décision de votre commune ; notre article explique la règle.',
          },
        ],
      },
    },
  },
  en: {
    demo: 'Book a demo',
    pricing: 'See pricing',
    guide: 'Read the full obligations guide',
    read: 'Read the article',
    faqTitle: 'Frequently asked questions',
    note: 'Baitly is in pre-launch. Check with us which scope is available for your property during the demo.',
    closingTitle: 'Your business, your local rules.',
    closingCopy:
      'Show us your day-to-day: we start from your properties, your channels and your filings.',
    countries: {
      maroc: {
        eyebrow: 'Baitly in Morocco',
        title: 'Vacation rental software\nbuilt for Morocco.',
        intro:
          'Apartments, riads, guesthouses: centralise your Airbnb, Booking.com and direct bookings, prepare your guests’ police records and track the tourist tax, in French, Arabic or English.',
        pointsTitle: 'What Baitly handles in Morocco',
        pointsCopy:
          'A PMS and channel manager that know your Moroccan filings, with no spreadsheet on the side.',
        points: [
          {
            title: 'One calendar for all your channels',
            copy: 'Airbnb, Booking.com and direct bookings synced in a single schedule to limit double bookings.',
          },
          {
            title: 'Guest details ready',
            copy: 'The identity details required for the DGSN police record are gathered as the booking progresses.',
          },
          {
            title: 'Tourist tax tracked',
            copy: 'The tourist tax is calculated by municipality and kept separate from the stay price in your accounts.',
          },
          {
            title: 'Your amounts in dirhams',
            copy: 'Rates, payments and statements in dirhams. Payment providers for Morocco are being selected.',
          },
          {
            title: 'Your direct booking website',
            copy: 'A booking engine in your colours to sell commission-free, alongside the platforms.',
          },
        ],
        rulesTitle: 'Accommodation rules in Morocco',
        rulesCopy:
          'Permit, insurance, guest e-declaration, tourist tax: our articles detail each obligation, with official texts.',
        faq: [
          {
            q: 'Does Baitly suit a riad or a guesthouse?',
            a: 'Yes. Baitly manages several rooms or units in one schedule, with the cleaning, arrivals and payments of every stay.',
          },
          {
            q: 'Do my Airbnb and Booking.com listings stay in place?',
            a: 'Yes. Baitly connects to your existing listings and syncs availability, rates and bookings; you keep your reviews and history.',
          },
          {
            q: 'Is Baitly available in Arabic?',
            a: 'Yes. Baitly works in French, in Arabic with right-to-left reading, and in English.',
          },
        ],
      },
      'arabie-saoudite': {
        eyebrow: 'Baitly in Saudi Arabia',
        title: 'Management software for private\nhospitality units in Saudi Arabia.',
        intro:
          'Furnished apartments, chalets, istirahas: manage your bookings, Shomoos declarations and ZATCA-compliant invoicing, in Arabic, with the Hijri calendar.',
        pointsTitle: 'What Baitly handles in Saudi Arabia',
        pointsCopy:
          'A PMS and channel manager built for the new private hospitality units regulation.',
        points: [
          {
            title: 'Arrivals declared',
            copy: 'Guest details are prepared for the Shomoos (شموس) declaration at every arrival.',
          },
          {
            title: 'Compliant invoicing',
            copy: '15% VAT, municipality fees and ZATCA-format invoices, calculated stay by stay.',
          },
          {
            title: 'Arabic first',
            copy: 'An Arabic interface with right-to-left reading, the Hijri calendar and amounts in riyals.',
          },
          {
            title: 'One calendar for all your channels',
            copy: 'Platform and direct bookings brought together in a single schedule.',
          },
          {
            title: 'Suitable payments',
            copy: 'Payment providers for Saudi Arabia are being selected, in line with the channels the regulation authorises.',
          },
        ],
        rulesTitle: 'The private hospitality units regulation',
        rulesCopy:
          'Ministry of Tourism licence, Shomoos, length of stay, municipality fee: our articles detail the regulation published on 11 September 2026.',
        faq: [
          {
            q: 'Do I need a licence to rent a private unit?',
            a: 'Yes. Since the regulation published on 11 September 2026, operating a private hospitality unit requires a valid Ministry of Tourism licence. Our article details the conditions.',
          },
          {
            q: 'Does Baitly support the Hijri calendar?',
            a: 'Yes. Dates display in the Hijri or Gregorian calendar, and the Arabic interface reads right to left.',
          },
          {
            q: 'Does Baitly suit chalets and istirahas?',
            a: 'Yes. Each unit has its own schedule, rates and arrival instructions.',
          },
        ],
      },
      france: {
        eyebrow: 'Baitly in France',
        title: 'Vacation rental and property\nmanagement software in France.',
        intro:
          'Tourist rentals, property managers, guesthouses: sync Airbnb and Booking.com, track the 120-night cap, the tourist tax and police records, and invoice in Factur-X.',
        pointsTitle: 'What Baitly handles in France',
        pointsCopy:
          'A PMS and channel manager that keep up with French tourist rental rules.',
        points: [
          {
            title: 'One calendar for all your channels',
            copy: 'Airbnb, Booking.com and direct bookings synced in a single schedule.',
          },
          {
            title: 'Rental rules kept',
            copy: 'Town hall registration number and a 120-night yearly cap for a main residence.',
          },
          {
            title: 'Tourist tax by municipality',
            copy: 'Calculated at the municipality’s rate and kept separate from the stay price.',
          },
          {
            title: 'Foreign guests declared',
            copy: 'The police record for foreign guests is prepared at arrival.',
          },
          {
            title: 'Payments and invoices',
            copy: 'Payments through Stripe in euros and Factur-X e-invoicing.',
          },
        ],
        rulesTitle: 'Tourist rental rules in France',
        rulesCopy:
          'Registration, 90 to 120 days, change of use, micro-BIC, tourist tax: our articles detail each rule, with official texts.',
        faq: [
          {
            q: 'Does Baitly suit a property management company?',
            a: 'Yes. Baitly manages several owners, their properties, cleaning and an owner portal to follow revenue.',
          },
          {
            q: 'Do my Airbnb and Booking.com listings stay in place?',
            a: 'Yes. Baitly connects to your existing listings; you keep your reviews and history.',
          },
          {
            q: 'Does Baitly track the 120-night limit?',
            a: 'Yes, for a main residence. The cap depends on your municipality’s decision; our article explains the rule.',
          },
        ],
      },
    },
  },
  ar: {
    demo: 'اطلب عرضاً تجريبياً',
    pricing: 'اطّلع على الأسعار',
    guide: 'اقرأ دليل الالتزامات كاملاً',
    read: 'اقرأ المقال',
    faqTitle: 'أسئلة شائعة',
    note: 'بيتلي في مرحلة ما قبل الإطلاق. تحقّق معنا من النطاق المتاح لمنشأتك خلال العرض التجريبي.',
    closingTitle: 'نشاطك، وأنظمتك المحلية.',
    closingCopy: 'أرنا يومك المعتاد: ننطلق من وحداتك وقنواتك وإجراءاتك.',
    countries: {
      maroc: {
        eyebrow: 'بيتلي في المغرب',
        title: 'برنامج إدارة الإيجارات السياحية\nالمصمَّم للمغرب.',
        intro:
          'شقق ورياض ودور ضيافة: اجمع حجوزات Airbnb وBooking.com والحجوزات المباشرة، وجهّز بطاقة الشرطة لنزلائك وتابع رسم الإقامة، بالفرنسية أو العربية أو الإنجليزية.',
        pointsTitle: 'ما يتولاه بيتلي في المغرب',
        pointsCopy: 'نظام إدارة عقارات ومدير قنوات يعرفان إجراءاتك المغربية، دون جداول جانبية.',
        points: [
          {
            title: 'تقويم واحد لكل قنواتك',
            copy: 'Airbnb وBooking.com وحجوزاتك المباشرة متزامنة في جدول واحد للحد من الحجز المزدوج.',
          },
          {
            title: 'بيانات النزلاء جاهزة',
            copy: 'تُجمع بيانات الهوية اللازمة لبطاقة الشرطة وفق صيغة المديرية العامة للأمن الوطني خلال مسار الحجز.',
          },
          {
            title: 'متابعة رسم الإقامة',
            copy: 'يُحتسب رسم الإقامة حسب الجماعة ويبقى منفصلاً عن سعر الإقامة في حساباتك.',
          },
          {
            title: 'مبالغك بالدرهم',
            copy: 'الأسعار والتحصيلات والكشوف بالدرهم. مزودو الدفع في المغرب قيد الاختيار.',
          },
          {
            title: 'موقعك للحجز المباشر',
            copy: 'محرك حجز بألوانك للبيع دون عمولة، إلى جانب المنصات.',
          },
        ],
        rulesTitle: 'إجراءات الإيواء في المغرب',
        rulesCopy:
          'الترخيص والتأمين والتصريح الإلكتروني بالنزلاء ورسم الإقامة: مقالاتنا تشرح كل التزام استناداً إلى النصوص الرسمية.',
        faq: [
          {
            q: 'هل يناسب بيتلي الرياض ودور الضيافة؟',
            a: 'نعم. يدير بيتلي عدة غرف أو وحدات في جدول واحد، مع التنظيف والوصول والمدفوعات لكل إقامة.',
          },
          {
            q: 'هل تبقى إعلاناتي على Airbnb وBooking.com كما هي؟',
            a: 'نعم. يتصل بيتلي بإعلاناتك الحالية ويزامن التوافر والأسعار والحجوزات، وتحتفظ بتقييماتك وسجلك.',
          },
          {
            q: 'هل بيتلي متاح بالعربية؟',
            a: 'نعم. يعمل بيتلي بالفرنسية، وبالعربية مع القراءة من اليمين إلى اليسار، وبالإنجليزية.',
          },
        ],
      },
      'arabie-saoudite': {
        eyebrow: 'بيتلي في السعودية',
        title: 'برنامج إدارة الشقق المفروشة\nووحدات الضيافة الخاصة في السعودية.',
        intro:
          'شقق مفروشة وشاليهات واستراحات: أدِر حجوزاتك وتسجيل النزلاء في شموس وفواتيرك المتوافقة مع هيئة الزكاة والضريبة والجمارك، بالعربية وبالتقويم الهجري.',
        pointsTitle: 'ما يتولاه بيتلي في السعودية',
        pointsCopy: 'نظام إدارة عقارات ومدير قنوات مبنيان للائحة وحدات الضيافة الخاصة الجديدة.',
        points: [
          {
            title: 'وصول مُبلَّغ عنه',
            copy: 'تُجهَّز بيانات النزلاء للتسجيل في منصة شموس عند كل وصول.',
          },
          {
            title: 'فوترة متوافقة',
            copy: 'ضريبة القيمة المضافة 15 % والرسوم البلدية وفاتورة بصيغة هيئة الزكاة والضريبة والجمارك، محتسبة لكل إقامة.',
          },
          {
            title: 'العربية أولاً',
            copy: 'واجهة عربية تُقرأ من اليمين إلى اليسار، وتقويم هجري، ومبالغ بالريال.',
          },
          {
            title: 'تقويم واحد لكل قنواتك',
            copy: 'حجوزات المنصات والحجوزات المباشرة مجتمعة في جدول واحد.',
          },
          {
            title: 'مدفوعات ملائمة',
            copy: 'مزودو الدفع في السعودية قيد الاختيار، بما يتوافق مع القنوات المعتمدة في اللائحة.',
          },
        ],
        rulesTitle: 'لائحة وحدات الضيافة الخاصة',
        rulesCopy:
          'ترخيص وزارة السياحة وشموس ومدة الإقامة والرسوم البلدية: مقالاتنا تشرح اللائحة المنشورة في 11 سبتمبر 2026.',
        faq: [
          {
            q: 'هل أحتاج إلى ترخيص لتأجير وحدة ضيافة خاصة؟',
            a: 'نعم. منذ اللائحة المنشورة في 11 سبتمبر 2026، يتطلب تشغيل وحدة الضيافة الخاصة ترخيصاً سارياً من وزارة السياحة. يشرح مقالنا الشروط.',
          },
          {
            q: 'هل يدعم بيتلي التقويم الهجري؟',
            a: 'نعم. تُعرض التواريخ بالتقويم الهجري أو الميلادي، وتُقرأ الواجهة العربية من اليمين إلى اليسار.',
          },
          {
            q: 'هل يناسب بيتلي الشاليهات والاستراحات؟',
            a: 'نعم. لكل وحدة جدولها وأسعارها وتعليمات الوصول الخاصة بها.',
          },
        ],
      },
      france: {
        eyebrow: 'بيتلي في فرنسا',
        title: 'برنامج إدارة الإيجارات السياحية\nوخدمات الكونسيرج في فرنسا.',
        intro:
          'مساكن سياحية وشركات إدارة ودور ضيافة: زامن Airbnb وBooking.com، وتابع سقف 120 ليلة ورسم الإقامة وبطاقة الشرطة، وأصدر فواتير Factur-X.',
        pointsTitle: 'ما يتولاه بيتلي في فرنسا',
        pointsCopy: 'نظام إدارة عقارات ومدير قنوات يلتزمان بالقواعد الفرنسية للإيجار السياحي.',
        points: [
          {
            title: 'تقويم واحد لكل قنواتك',
            copy: 'Airbnb وBooking.com وحجوزاتك المباشرة متزامنة في جدول واحد.',
          },
          {
            title: 'قواعد إيجار محترمة',
            copy: 'رقم التسجيل لدى البلدية وسقف 120 ليلة سنوياً للسكن الرئيسي.',
          },
          {
            title: 'رسم الإقامة حسب البلدية',
            copy: 'يُحتسب وفق تعرفة البلدية ويبقى منفصلاً عن سعر الإقامة.',
          },
          {
            title: 'التبليغ عن النزلاء الأجانب',
            copy: 'تُجهَّز بطاقة الشرطة للنزلاء الأجانب عند الوصول.',
          },
          {
            title: 'المدفوعات والفواتير',
            copy: 'تحصيل عبر Stripe باليورو وفاتورة Factur-X الإلكترونية.',
          },
        ],
        rulesTitle: 'قواعد المسكن السياحي في فرنسا',
        rulesCopy:
          'التسجيل و90 إلى 120 يوماً وتغيير الاستخدام ونظام micro-BIC ورسم الإقامة: مقالاتنا تشرح كل قاعدة استناداً إلى النصوص الرسمية.',
        faq: [
          {
            q: 'هل يناسب بيتلي شركات الكونسيرج؟',
            a: 'نعم. يدير بيتلي عدة ملاك ووحداتهم والتنظيف، مع بوابة للملاك لمتابعة الإيرادات.',
          },
          {
            q: 'هل تبقى إعلاناتي على Airbnb وBooking.com كما هي؟',
            a: 'نعم. يتصل بيتلي بإعلاناتك الحالية، وتحتفظ بتقييماتك وسجلك.',
          },
          {
            q: 'هل يتابع بيتلي حد 120 ليلة؟',
            a: 'نعم، للسكن الرئيسي. يتوقف السقف على قرار بلديتك، ويشرح مقالنا القاعدة.',
          },
        ],
      },
    },
  },
};
