// Textes à l'écran du Reel 06 « Arabie saoudite ». Version ARABE UNIQUEMENT (marché saoudien).
// Faits repris de la landing (messages/home.ts, section `local`) et du code :
//   - Shomoos : libellés du panneau de conformité (reservations.compliance.* dans ar.json) ;
//   - TVA 15 % et frais municipaux 5 % du tarif de la nuitée (SaudiTaxCalculator) ;
//   - PayTabs et encaissement en riyals, à côté de Stripe (PaymentSettings) ;
//   - calendrier hégirien Umm al-Qura, chiffres latins (utils/localeDate.ts).
// Dates : 12 → 16 octobre 2026 = 1 → 5 Joumada al-Oula 1448 (Intl, islamic-umalqura).
const PLAN_EN = {
  corner: 'Property', blocked: 'Blocked', nights: (n) => (n === 1 ? '1 night' : `${n} nights`),
  rows: [['Nakheel Chalet', 'Riyadh'], ['Diriyah Villa', 'Riyadh'], ['Olaya Studio', 'Riyadh'], ['Malqa Flat', 'Riyadh']],
  guests: { omar: ['O', 'Omar'], sara: ['S', 'Sara'], jad: ['J', 'Jad'], nadia: ['N', 'Nadia'], karim: ['K', 'Karim'] },
  prices: { omar: '1,440', jad: '1,290', karim: '1,560', fee: '80' },
  days: [['Mon', 12], ['Tue', 13], ['Wed', 14], ['Thu', 15], ['Fri', 16]],
  weekend: [],
};

window.STRINGS = {
  ar: {
    dir: 'rtl', illustrative: 'مشهد توضيحي',
    // A · accroche
    eyebrowA: 'منصة تسجيل النزلاء', tA: 'شموس',
    // B · Riyad n'est pas Paris
    riyadh: ['الرياض', 'استراحة'], paris: ['باريس', 'شقة'],
    tB1: 'الاستراحة ليست شقة.', tB1Em: ['الاستراحة'],
    tB2: 'وأداتك ينبغي أن تعرف الفرق.', tB2Em: ['الفرق.'],
    otaTitle: 'متصل بقنواتك',
    otas: ['gathern', 'mabeet', 'airbnb', 'booking', 'agoda', 'expedia'],
    // C · Shomoos
    tC: 'كل نزيل، مُسجَّل.', tCEm: ['مُسجَّل.'],
    shomoos: {
      title: 'تسجيل النزلاء', provider: 'شموس',
      guest: 'عمر', stay: 'شاليه النخيل · 1 ← 4 جمادى الأولى · 3 ليالٍ',
      rows: ['المسافر الرئيسي · عمر', 'المرافق 1', 'المرافق 2'],
      wait: 'بانتظار الإرسال', done: 'تم الإرسال', detail: 'شموس · 1 جمادى الأولى · 15:02',
      btn: 'إرسال إلى شموس', btnDone: 'أُرسلت 3 بطاقات',
    },
    // D · facture
    tD: 'ضريبة صحيحة من أول مرة.', tDEm: ['صحيحة'],
    invoice: {
      title: 'فاتورة ضريبية مبسطة', number: 'INV-2026-0142', date: '4 جمادى الأولى 1448 · 15 أكتوبر 2026',
      seller: 'شاليه النخيل · الرياض', unit: 'ر.س',
      lines: [['الإقامة', '3 ليالٍ × 400', '1,200.00'], ['ضريبة القيمة المضافة', '15%', '180.00'], ['الرسوم البلدية', '5% من سعر الليلة', '60.00']],
      total: ['الإجمالي', '1,440.00'], qr: 'ZATCA', issued: 'الفاتورة الإلكترونية صادرة',
    },
    chipsD: ['ضريبة القيمة المضافة 15%', 'الرسوم البلدية 5%', 'ZATCA'],
    // E · paiement
    tE: 'التحصيل بالريال.', tEEm: ['بالريال.'],
    // Fenêtre « Un séjour, un paiement » de la landing (baitlyProductDemos.ts › finance, AR),
    // montants marocains repris de la démo (850 / 2 550), montants saoudiens de la facture ci-dessus.
    pay: {
      title: 'إقامة واحدة، دفعة واحدة', countries: ['المغرب', 'السعودية', 'فرنسا'],
      name: 'شاليه النخيل', stay: '3 ليالٍ · نزيلان', ref: '#BT-2409',
      nightly: 'سعر الليلة', total: 'مبلغ الإقامة', method: 'مثال على مزوّد',
      ma: { unit: 'د.م', nightly: 850, total: 2550, logo: 'payzone.svg', cta: 'تحصيل 2,550 د.م' },
      sa: { unit: 'ر.س', nightly: 400, total: 1440, name: 'PayTabs', cta: 'تحصيل 1,440 ر.س' },
      also: 'إلى جانب', done: 'تمت مطابقة الدفعة', receipt: 'تم ربط الدفعة بالحجز.',
      steps: ['الحجز', 'الدفع', 'المطابقة'],
    },
    // F · planning RTL + hégirien
    tF: 'واجهة عربية، بحق.', tFEm: ['بحق.'],
    chipsF: ['العربية', 'من اليمين إلى اليسار', 'التقويم الهجري'],
    planEn: PLAN_EN,
    plan: Object.assign({}, PLAN_EN, {
      corner: 'العقار', blocked: 'مغلق', nights: (n) => (n === 1 ? 'ليلة' : n === 2 ? 'ليلتان' : `${n} ليالٍ`),
      rows: [['شاليه النخيل', 'الرياض'], ['فيلا الدرعية', 'الرياض'], ['استوديو العليا', 'الرياض'], ['شقة الملقا', 'الرياض']],
      guests: { omar: ['ع', 'عمر'], sara: ['س', 'سارة'], jad: ['ج', 'جاد'], nadia: ['ن', 'نادية'], karim: ['ك', 'كريم'] },
      days: [['الاثنين', 12], ['الثلاثاء', 13], ['الأربعاء', 14], ['الخميس', 15], ['الجمعة', 16]],
      weekend: [4],
    }),
    hijri: { month: 'جمادى الأولى 1448', days: [1, 2, 3, 4, 5], greg: ['12 أكتوبر', '13 أكتوبر', '14 أكتوبر', '15 أكتوبر', '16 أكتوبر'] },
    // G · promesse + fin
    promise: ['على دراية بمهنتك.', 'وبواقعك.'],
    cta: 'انضم إلى ما قبل الإطلاق',
    facts: [['شموس', 'تسجيل النزلاء'], ['15% · 5%', 'ضريبة ورسوم بلدية'], ['PayTabs', 'بالريال'], ['AR', 'من اليمين إلى اليسار']],
    subtitles: [
      { from: 0.3, to: 3.3, text: 'هل يعرف برنامجك ما هي ', em: 'شموس؟' },
      { from: 3.5, to: 6.5, text: 'الاستراحة في الرياض ', em: 'لا تُدار كشقة في باريس.' },
      { from: 6.5, to: 9.1, text: 'وأداتك ينبغي أن ', em: 'تعرف الفرق.' },
      { from: 9.2, to: 16.9, text: 'مع بيتلي، يُسجَّل كل نزيل على ', em: 'منصة شموس', after: '، كما يشترط قطاع الإيواء.' },
      { from: 16.9, to: 21.2, text: 'ضريبة القيمة المضافة 15%، ', em: 'والرسوم البلدية 5%', after: '، تُحسبان تلقائياً.' },
      { from: 21.2, to: 25.1, text: 'وتصدر الفاتورة الإلكترونية ', em: 'عبر هيئة الزكاة والضريبة والجمارك.' },
      { from: 25.2, to: 31.1, text: 'ونزلاؤك يدفعون ', em: 'بالريال، عبر PayTabs', after: '، إلى جانب Stripe.' },
      { from: 32.3, to: 39.1, text: 'وواجهتك عربية بحق: ', em: 'من اليمين إلى اليسار، وبالتقويم الهجري.' },
    ],
  },
};
