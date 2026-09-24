import type { SiteLanguage } from '../siteLanguage';

interface StayCopy {
  calendar: string;
  dateIntro: string;
  chooseArrival: string;
  chooseDeparture: string;
  previousMonth: string;
  nextMonth: string;
  unavailable: string;
  available: string;
  rangeError: string;
  nights: string;
  oneNight: string;
  nightPrice: string;
  datesReady: string;
  confirmDates: string;
  editDates: string;
  sample: string;
  roomsTitle: string;
  villaTitle: string;
  collectionTitle: string;
  roomIntro: string;
  collectionIntro: string;
  choose: string;
  chosen: string;
  chooseProperty: string;
  chooseDates: string;
  selectedCount: string;
  selectedOne: string;
  terraceSuite: string;
  terraceDetail: string;
  privateTerrace: string;
  agafayDetail: string;
  desertView: string;
  marrakech: string;
  agafay: string;
}

export const BOOKING_STAY_COPY: Record<SiteLanguage, StayCopy> = {
  fr: {
    calendar: 'Calendrier du séjour',
    dateIntro:
      'Choisissez votre arrivée, puis votre départ. Votre escapade commence ici.',
    chooseArrival: 'Choisir l’arrivée',
    chooseDeparture: 'Choisir le départ',
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    unavailable: 'Indisponible',
    available: 'Disponible',
    rangeError:
      'Cette période contient une nuit indisponible. Choisissez un autre départ ou une nouvelle arrivée.',
    nights: '{count} nuits',
    oneNight: '1 nuit',
    nightPrice: 'Prix par nuit',
    datesReady: 'Votre séjour',
    confirmDates: 'Confirmer mes dates',
    editDates: 'Modifier les dates',
    sample: 'Disponibilités et prix de démonstration.',
    roomsTitle: 'Trouvez votre chambre préférée.',
    villaTitle: 'Votre villa, rien que pour vous.',
    collectionTitle: 'Choisissez la bonne adresse.',
    roomIntro:
      'Deux ambiances, la même hospitalité. Sélectionnez la suite qui vous ressemble.',
    collectionIntro:
      'Choisissez un ou plusieurs logements pour les mêmes dates. Chaque sélection rejoint votre panier.',
    choose: 'Sélectionner',
    chosen: 'Sélectionné',
    chooseProperty: 'Choisissez un hébergement pour continuer.',
    chooseDates: 'Choisissez vos dates',
    selectedCount: '{count} logements sélectionnés',
    selectedOne: '1 logement sélectionné',
    terraceSuite: 'La Suite Terrasse',
    terraceDetail: '45 m² · lit king size · 2 voyageurs',
    privateTerrace: 'Terrasse privée · petit-déjeuner inclus',
    agafayDetail: '2 chambres · 4 voyageurs',
    desertView: 'Terrasse avec vue sur le désert',
    marrakech: 'Marrakech, Maroc',
    agafay: 'Agafay, Maroc',
  },
  en: {
    calendar: 'Stay calendar',
    dateIntro:
      'Choose your arrival, then your departure. Your getaway starts here.',
    chooseArrival: 'Choose check-in',
    chooseDeparture: 'Choose check-out',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    unavailable: 'Unavailable',
    available: 'Available',
    rangeError:
      'This range includes an unavailable night. Choose another check-out or a new check-in date.',
    nights: '{count} nights',
    oneNight: '1 night',
    nightPrice: 'Price per night',
    datesReady: 'Your stay',
    confirmDates: 'Confirm my dates',
    editDates: 'Edit dates',
    sample: 'Sample availability and prices.',
    roomsTitle: 'Find your favourite room.',
    villaTitle: 'Your villa, all to yourself.',
    collectionTitle: 'Find your perfect address.',
    roomIntro:
      'Two different moods, the same hospitality. Choose the suite that feels like you.',
    collectionIntro:
      'Choose one or more properties for the same dates. Each selection is added to your cart.',
    choose: 'Select',
    chosen: 'Selected',
    chooseProperty: 'Choose a property to continue.',
    chooseDates: 'Choose your dates',
    selectedCount: '{count} selected properties',
    selectedOne: '1 selected property',
    terraceSuite: 'The Terrace Suite',
    terraceDetail: '45 m² · king-size bed · 2 guests',
    privateTerrace: 'Private terrace · breakfast included',
    agafayDetail: '2 bedrooms · 4 guests',
    desertView: 'Terrace with a desert view',
    marrakech: 'Marrakech, Morocco',
    agafay: 'Agafay, Morocco',
  },
  ar: {
    calendar: 'تقويم الإقامة',
    dateIntro: 'اختر تاريخ الوصول ثم المغادرة. رحلتك تبدأ هنا.',
    chooseArrival: 'اختر الوصول',
    chooseDeparture: 'اختر المغادرة',
    previousMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    unavailable: 'غير متاح',
    available: 'متاح',
    rangeError:
      'تتضمن هذه الفترة ليلة غير متاحة. اختر مغادرة أخرى أو تاريخ وصول جديداً.',
    nights: 'عدد الليالي: {count}',
    oneNight: 'ليلة واحدة',
    nightPrice: 'السعر لليلة',
    datesReady: 'إقامتك',
    confirmDates: 'تأكيد التواريخ',
    editDates: 'تعديل التواريخ',
    sample: 'توافر وأسعار للتوضيح.',
    roomsTitle: 'اختر غرفتك المفضلة.',
    villaTitle: 'فيلا خاصة لك وحدك.',
    collectionTitle: 'اختر العنوان المناسب.',
    roomIntro: 'أجواء مختلفة وضيافة واحدة. اختر الجناح الذي يناسبك.',
    collectionIntro:
      'اختر مكان إقامة أو أكثر للتواريخ نفسها. تضاف اختياراتك إلى السلة.',
    choose: 'اختيار',
    chosen: 'تم الاختيار',
    chooseProperty: 'اختر مكان إقامة للمتابعة.',
    chooseDates: 'اختر تواريخك',
    selectedCount: 'أماكن الإقامة المختارة: {count}',
    selectedOne: 'مكان إقامة واحد مختار',
    terraceSuite: 'جناح الشرفة',
    terraceDetail: '45 م² · سرير كبير · ضيفان',
    privateTerrace: 'شرفة خاصة · الفطور مشمول',
    agafayDetail: 'غرفتان · 4 ضيوف',
    desertView: 'شرفة تطل على الصحراء',
    marrakech: 'مراكش، المغرب',
    agafay: 'أكافاي، المغرب',
  },
};
