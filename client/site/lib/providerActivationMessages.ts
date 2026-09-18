const fr = {
  activation: 'Activation', title: 'Définissez votre mot de passe', ready: 'Votre compte est prêt',
  success: 'Votre mot de passe a été enregistré. Vous pouvez vous connecter à Baitly.',
  login: 'Me connecter à Baitly', lastStep: 'Dernière étape pour', checking: 'Vérification du lien…',
  password: 'Mot de passe', confirmation: 'Confirmation', minimum: '8 caractères minimum.',
  mismatch: 'Les deux saisies diffèrent.', submit: 'Activer mon compte', pending: 'Activation en cours…',
  incomplete: 'Lien incomplet. Utilisez celui reçu par courriel.',
  invalid: 'Ce lien est expiré, déjà utilisé ou indisponible.',
  linkHelp: 'Ouvrez le dernier lien reçu. Si le problème persiste, contactez l’équipe pour obtenir une nouvelle invitation.',
  failed: 'L’activation n’a pas abouti. Réessayez dans un instant.',
  rejected: 'Le mot de passe ou le lien a été refusé. Vérifiez les champs ; si nécessaire, demandez une nouvelle invitation.',
  limited: 'Trop de tentatives. Patientez avant de réessayer.',
};
type Messages = { [Key in keyof typeof fr]: string };
const en: Messages = {
  activation: 'Activation', title: 'Set your password', ready: 'Your account is ready',
  success: 'Your password has been saved. You can now sign in to Baitly.', login: 'Sign in to Baitly',
  lastStep: 'Final step for', checking: 'Checking your link…', password: 'Password', confirmation: 'Confirm password',
  minimum: 'At least 8 characters.', mismatch: 'The passwords do not match.', submit: 'Activate my account', pending: 'Activating…',
  incomplete: 'Incomplete link. Use the link you received by email.', invalid: 'This link has expired, has already been used or is unavailable.',
  linkHelp: 'Open the latest link you received. If the problem persists, contact the team for a new invitation.',
  failed: 'Activation did not complete. Please try again shortly.',
  rejected: 'The password or link was rejected. Check the fields and request a new invitation if needed.',
  limited: 'Too many attempts. Please wait before trying again.',
};
const ar: Messages = {
  activation: 'التفعيل', title: 'عيّن كلمة مرورك', ready: 'حسابك جاهز',
  success: 'تم حفظ كلمة مرورك. يمكنك الآن تسجيل الدخول إلى Baitly.', login: 'تسجيل الدخول إلى Baitly',
  lastStep: 'الخطوة الأخيرة من أجل', checking: 'جارٍ التحقق من الرابط…', password: 'كلمة المرور', confirmation: 'تأكيد كلمة المرور',
  minimum: '8 أحرف على الأقل.', mismatch: 'كلمتا المرور غير متطابقتين.', submit: 'تفعيل حسابي', pending: 'جارٍ التفعيل…',
  incomplete: 'الرابط غير مكتمل. استخدم الرابط الذي تلقيته عبر البريد الإلكتروني.', invalid: 'انتهت صلاحية هذا الرابط أو استُخدم بالفعل أو أصبح غير متاح.',
  linkHelp: 'افتح أحدث رابط تلقيته. إذا استمرت المشكلة، تواصل مع الفريق للحصول على دعوة جديدة.',
  failed: 'لم يكتمل التفعيل. حاول مجددًا بعد قليل.',
  rejected: 'تم رفض كلمة المرور أو الرابط. تحقق من الحقول واطلب دعوة جديدة عند الحاجة.',
  limited: 'محاولات كثيرة جدًا. انتظر قبل إعادة المحاولة.',
};
export const providerActivationMessages = { fr, en, ar };
