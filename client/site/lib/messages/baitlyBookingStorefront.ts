import type { SiteLanguage } from '../siteLanguage';

interface StorefrontCopy {
  preview: string;
  book: string;
  direct: string;
  night: string;
  nights: string;
  optional: string;
  secure: string;
  summary: string;
  demoPayment: string;
  weekdays: string[];
  dateExample: string;
  selection: string;
  journey: string;
  rates: {
    title: string;
    direct: string;
    reference: string;
    badge: string;
    savings: string;
    included: string;
    example: string;
    note: string;
  };
  templates: {
    signature: string;
    title: string;
    subtitle: string;
    nav: [string, string, string];
    room: string;
    roomCopy: string;
    amenities: [string, string, string];
    extras: [string, string];
  }[];
}

export const BOOKING_STOREFRONT_COPY: Record<SiteLanguage, StorefrontCopy> = {
  fr: {
    preview: 'Aperçu du site',
    book: 'Réserver mon séjour',
    direct: 'En direct avec votre hôte',
    night: '/ nuit',
    nights: '3 nuits',
    optional: 'À la carte',
    secure: 'Paiement sécurisé',
    summary: 'Détail de votre séjour',
    demoPayment: 'Fin de la démo · aucun paiement',
    weekdays: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    dateExample: 'Exemple de disponibilités · octobre 2026',
    selection: 'Notre sélection',
    journey: 'Votre itinéraire',
    rates: {
      title: 'Le privilège de réserver en direct.',
      direct: 'Sur le site de l’hôte',
      reference: 'Exemple de tarif OTA',
      badge: '{discount} en direct',
      savings: 'économisés sur l’hébergement',
      included: 'Avantage direct inclus',
      example: 'Tarifs d’exemple',
      note: 'Comparaison illustrative pour le même hébergement et les mêmes dates, hors options. Les tarifs réels varient selon l’hôte et le canal.',
    },
    templates: [
      {
        signature: 'RIAD & MAISON D’HÔTES',
        title: 'Un refuge secret, au cœur de la médina.',
        subtitle:
          'La fraîcheur du patio. La douceur des matins. Marrakech, à votre rythme.',
        nav: ['Nos suites', 'Votre séjour', 'À vivre ici'],
        room: 'La Suite Patio',
        roomCopy:
          'Tadelakt, matières naturelles et lumière douce. Votre adresse intime à deux pas des souks.',
        amenities: [
          '32 m² · lit king size',
          'Vue sur le patio',
          'Petit-déjeuner inclus',
        ],
        extras: [
          'Une table dressée dans le patio, un menu marocain à partager à deux.',
          'Votre chauffeur vous accueille à l’aéroport et vous accompagne au riad.',
        ],
      },
      {
        signature: 'PRIVATE VILLA · MARRAKECH',
        title: 'Le luxe de se sentir chez soi.',
        subtitle:
          'Une piscine, un jardin, et du temps pour vous. La villa vous appartient le temps d’une parenthèse.',
        nav: ['La villa', 'Disponibilités', 'Les attentions'],
        room: 'Toute la villa, rien que pour vous',
        roomCopy:
          'De grandes chambres ouvertes sur le jardin, une terrasse à l’ombre et votre piscine privée.',
        amenities: [
          '3 chambres · 6 voyageurs',
          'Piscine privée',
          'Jardin & terrasse',
        ],
        extras: [
          'Un chef cuisine sur place un dîner imaginé pour vous.',
          'Profitez de la piscine un peu plus longtemps. Départ à 16 h.',
        ],
      },
      {
        signature: 'DES ADRESSES À VIVRE',
        title: 'L’ailleurs commence par une belle adresse.',
        subtitle:
          'Du silence d’Agafay aux ruelles de Marrakech. Trois adresses, une même envie de prendre le temps.',
        nav: ['Les adresses', 'Mon voyage', 'Les expériences'],
        room: 'La terrasse d’Agafay',
        roomCopy:
          'Une maison ouverte sur le désert. Prolongez votre escapade avec une nuit dans la médina.',
        amenities: ['3 adresses', 'Séjours au Maroc', 'Un seul panier'],
        extras: [
          'Un trajet privé pour rejoindre tranquillement votre prochaine adresse.',
          'À votre arrivée, une table et les saveurs de la maison vous attendent.',
        ],
      },
    ],
  },
  en: {
    preview: 'Website preview',
    book: 'Book my stay',
    direct: 'Directly with your host',
    night: '/ night',
    nights: '3 nights',
    optional: 'Make it yours',
    secure: 'Secure payment',
    summary: 'Your stay in detail',
    demoPayment: 'End of demo · no payment',
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    dateExample: 'Sample availability · October 2026',
    selection: 'Our selection',
    journey: 'Your itinerary',
    rates: {
      title: 'The privilege of booking direct.',
      direct: 'On your host’s website',
      reference: 'Sample OTA rate',
      badge: '{discount} when booking direct',
      savings: 'saved on accommodation',
      included: 'Direct booking savings included',
      example: 'Illustrative rates',
      note: 'Illustrative comparison for the same accommodation and dates, excluding extras. Actual rates vary by host and channel.',
    },
    templates: [
      {
        signature: 'RIAD & GUESTHOUSE',
        title: 'A secret retreat, in the heart of the medina.',
        subtitle:
          'A cool courtyard. Slow mornings. Marrakech, at your own pace.',
        nav: ['Our suites', 'Your stay', 'Experiences'],
        room: 'The Patio Suite',
        roomCopy:
          'Tadelakt walls, natural textures and soft light. Your intimate hideaway just steps from the souks.',
        amenities: [
          '32 m² · king-size bed',
          'Courtyard view',
          'Breakfast included',
        ],
        extras: [
          'A table in the courtyard and a Moroccan menu to share.',
          'Your driver meets you at the airport and takes you to the riad.',
        ],
      },
      {
        signature: 'PRIVATE VILLA · MARRAKECH',
        title: 'The luxury of feeling at home.',
        subtitle:
          'A pool, a garden, and time for yourself. A private villa for your own little escape.',
        nav: ['The villa', 'Availability', 'Thoughtful extras'],
        room: 'The whole villa, just for you',
        roomCopy:
          'Spacious bedrooms opening onto the garden, a shaded terrace and your own private pool.',
        amenities: [
          '3 bedrooms · 6 guests',
          'Private pool',
          'Garden & terrace',
        ],
        extras: [
          'A chef prepares a dinner made just for you, in your villa.',
          'Enjoy the pool a little longer. Check out at 4 pm.',
        ],
      },
      {
        signature: 'PLACES TO CALL YOUR OWN',
        title: 'Every journey begins with a special place.',
        subtitle:
          'From peaceful Agafay to the streets of Marrakech. Three addresses, one invitation to slow down.',
        nav: ['The collection', 'My journey', 'Experiences'],
        room: 'The Agafay terrace',
        roomCopy:
          'A home looking out over the desert. Extend your escape with a night in the medina.',
        amenities: ['3 properties', 'Stays in Morocco', 'One shared cart'],
        extras: [
          'A private transfer to your next address, at your own pace.',
          'A table and the flavours of the house await your arrival.',
        ],
      },
    ],
  },
  ar: {
    preview: 'معاينة الموقع',
    book: 'احجز إقامتي',
    direct: 'مباشرة مع مضيفك',
    night: '/ ليلة',
    nights: '3 ليالٍ',
    optional: 'حسب رغبتك',
    secure: 'دفع آمن',
    summary: 'تفاصيل إقامتك',
    demoPayment: 'نهاية العرض · دون دفع',
    weekdays: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'],
    dateExample: 'مثال على التوافر · أكتوبر 2026',
    selection: 'اختياراتنا',
    journey: 'مسار رحلتك',
    rates: {
      title: 'ميزة الحجز المباشر.',
      direct: 'على موقع المضيف',
      reference: 'مثال لسعر عبر منصة حجز',
      badge: '{discount} عند الحجز المباشر',
      savings: 'توفير على سعر الإقامة',
      included: 'ميزة الحجز المباشر مشمولة',
      example: 'أسعار توضيحية',
      note: 'مقارنة توضيحية لنفس الإقامة والتواريخ، دون الخدمات الإضافية. تختلف الأسعار الفعلية حسب المضيف وقناة الحجز.',
    },
    templates: [
      {
        signature: 'رياض ودار ضيافة',
        title: 'ملاذ هادئ في قلب المدينة العتيقة.',
        subtitle: 'برودة الفناء ولطف الصباح. اكتشف مراكش على إيقاعك.',
        nav: ['أجنحتنا', 'إقامتك', 'تجاربنا'],
        room: 'جناح الفناء',
        roomCopy:
          'تادلاكت وخامات طبيعية وضوء هادئ. عنوانك الحميم على بعد خطوات من الأسواق.',
        amenities: ['32 م² · سرير كبير', 'إطلالة على الفناء', 'الفطور مشمول'],
        extras: [
          'مائدة في الفناء وقائمة مغربية تتشاركانها.',
          'سائق يستقبلك في المطار ويرافقك إلى الرياض.',
        ],
      },
      {
        signature: 'فيلا خاصة · مراكش',
        title: 'رفاهية الشعور بأنك في بيتك.',
        subtitle:
          'مسبح وحديقة ووقت لك وحدك. فيلا خاصة للاستمتاع باستراحة على مهل.',
        nav: ['الفيلا', 'التوافر', 'لمسات خاصة'],
        room: 'الفيلا كاملة، لك وحدك',
        roomCopy: 'غرف واسعة تطل على الحديقة وشرفة مظللة ومسبحك الخاص.',
        amenities: ['3 غرف · 6 ضيوف', 'مسبح خاص', 'حديقة وشرفة'],
        extras: [
          'طاهٍ يحضر لك عشاءً خاصاً داخل الفيلا.',
          'استمتع بالمسبح لفترة أطول. المغادرة عند الرابعة مساءً.',
        ],
      },
      {
        signature: 'عناوين تستحق الإقامة',
        title: 'كل رحلة تبدأ بعنوان مميز.',
        subtitle:
          'من هدوء أكافاي إلى أزقة مراكش. ثلاثة عناوين ودعوة واحدة للاستمتاع على مهل.',
        nav: ['العناوين', 'رحلتي', 'التجارب'],
        room: 'شرفة أكافاي',
        roomCopy: 'بيت يطل على الصحراء. أكمل رحلتك بليلة في المدينة العتيقة.',
        amenities: ['ثلاثة عناوين', 'إقامات في المغرب', 'سلة واحدة'],
        extras: [
          'نقل خاص إلى عنوانك التالي بكل راحة.',
          'مائدة ونكهات البيت تنتظر وصولك.',
        ],
      },
    ],
  },
};
