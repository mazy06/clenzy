import type { SiteLanguage } from '../siteLanguage';

interface CheckoutCopy {
  title: string;
  intro: string;
  guest: string;
  guestAction: string;
  guestReady: string;
  card: string;
  cardAction: string;
  cardReady: string;
  cardDetail: string;
  pay: string;
  processing: string;
  processingCopy: string;
  simulated: string;
  reference: string;
  receipt: string;
  receiptCopy: string;
  paid: string;
  next: string;
  continue: string;
}

export const BOOKING_CHECKOUT_COPY: Record<SiteLanguage, CheckoutCopy> = {
  fr: {
    title: 'La dernière étape avant l’évasion.',
    intro: 'Votre hébergement et vos attentions, en un seul paiement.',
    guest: 'Vos coordonnées',
    guestAction: 'Utiliser le voyageur d’exemple',
    guestReady: 'Voyageur renseigné',
    card: 'Moyen de paiement',
    cardAction: 'Utiliser la carte de démonstration',
    cardReady: 'Carte de démonstration sélectionnée',
    cardDetail: '12 / 28 · CVC •••',
    pay: 'Payer {amount} · simulation',
    processing: 'Validation du paiement…',
    processingCopy: 'Nous simulons la validation de votre réservation.',
    simulated: 'Simulation uniquement · aucune donnée bancaire ni aucun débit.',
    reference: 'Référence de démonstration',
    receipt: 'Votre confirmation, prête à être envoyée.',
    receiptCopy:
      'Séjour, services et reçu réunis dans un email à camille@example.com. Aucun email envoyé dans cette démo.',
    paid: 'Paiement simulé validé',
    next: 'Découvrir {name}',
    continue: 'Passer au paiement',
  },
  en: {
    title: 'One last step before your getaway.',
    intro: 'Your accommodation and thoughtful extras, in one payment.',
    guest: 'Your details',
    guestAction: 'Use the sample guest',
    guestReady: 'Guest details added',
    card: 'Payment method',
    cardAction: 'Use the demonstration card',
    cardReady: 'Demonstration card selected',
    cardDetail: '12 / 28 · CVC •••',
    pay: 'Pay {amount} · simulation',
    processing: 'Validating payment…',
    processingCopy: 'We are simulating your booking confirmation.',
    simulated: 'Simulation only · no bank details or actual charge.',
    reference: 'Demo booking reference',
    receipt: 'Your confirmation, ready to send.',
    receiptCopy:
      'Stay, extras and receipt in one email to camille@example.com. No email is sent in this demo.',
    paid: 'Simulated payment approved',
    next: 'Discover {name}',
    continue: 'Continue to payment',
  },
  ar: {
    title: 'خطوة أخيرة قبل رحلتك.',
    intro: 'إقامتك وخدماتك الإضافية في دفعة واحدة.',
    guest: 'بياناتك',
    guestAction: 'استخدام بيانات الضيف التجريبية',
    guestReady: 'تمت إضافة بيانات الضيف',
    card: 'طريقة الدفع',
    cardAction: 'استخدام البطاقة التجريبية',
    cardReady: 'تم اختيار البطاقة التجريبية',
    cardDetail: '12 / 28 · CVC •••',
    pay: 'دفع {amount} · محاكاة',
    processing: 'جارٍ التحقق من الدفع…',
    processingCopy: 'نحاكي تأكيد حجزك.',
    simulated: 'محاكاة فقط · دون بيانات بنكية أو خصم فعلي.',
    reference: 'مرجع الحجز التجريبي',
    receipt: 'تأكيدك جاهز للإرسال.',
    receiptCopy:
      'الإقامة والخدمات والإيصال في رسالة إلى camille@example.com. لا يتم إرسال أي رسالة في هذا العرض.',
    paid: 'تم تأكيد الدفع التجريبي',
    next: 'اكتشف {name}',
    continue: 'المتابعة إلى الدفع',
  },
};
