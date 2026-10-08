import type { LegalBlock } from './types';

/** Actual storage inventory, shared by the landing and PMS privacy documents.
 * Audited 2026-10-08. Update together with siteCookieChoice and the notice version.
 * References: https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi
 * https://www.cnil.fr/sites/default/files/2026-01/recommandation_cookies_consolidee.pdf
 * https://www.cloudflare.com/turnstile-privacy-policy/
 * Before public launch: complete the publisher's legal identity in the shared
 * corpus and verify the actual hosting/WAF cookies and retention settings.
 */
export const COOKIE_POLICY: Record<'fr' | 'en' | 'ar', LegalBlock> = {
  fr: {
    id: 'cookies', heading: '10. Cookies et stockage du navigateur',
    paragraphs: [
      'Le site vitrine Baitly utilise uniquement les cookies et stockages nécessaires aux services demandés. Aucun outil de mesure d’audience, pixel publicitaire ou traceur de réseaux sociaux n’y est activé. Les polices, illustrations et démonstrations sont hébergées avec le site. Les cookies nécessaires relèvent de l’exemption de consentement de l’article 82 de la loi Informatique et Libertés ; ils ne servent pas à suivre votre navigation à des fins publicitaires.',
      'La fenêtre « Gérer les cookies » propose Accepter et Refuser avec la même facilité. Dans la configuration actuelle, les deux choix laissent uniquement les stockages nécessaires ci-dessous. Accepter n’autorise aucun futur outil : toute nouvelle finalité ou tout nouveau prestataire de suivi nécessitera une information mise à jour et un nouveau choix préalable. Fermer la fenêtre, faire défiler la page ou continuer à naviguer ne vaut jamais consentement.',
      'Votre choix et son horodatage sont conservés six mois sur ce navigateur et cette adresse de site, sans identifiant publicitaire et sans synchronisation avec votre compte. Le refus a la même durée que l’acceptation. Vous pouvez modifier ou retirer votre choix à tout moment via « Gérer les cookies » en pied de page du site vitrine. Si le navigateur bloque le stockage, le choix reste valable pour la page en cours et sera redemandé lors d’une prochaine visite.',
      'La fenêtre est limitée au site vitrine. Elle ne supprime pas les cookies nécessaires à la connexion au PMS ni à une candidature prestataire, et ne vaut pas consentement au suivi sur le PMS, un autre domaine ou un autre appareil. Les clés historiques commençant par « clenzy » ci-dessous sont des noms techniques conservés pour la compatibilité de Baitly. Contact pour vos questions ou l’exercice de vos droits : contact@baitly.fr.',
      'Lorsqu’elle est activée sur le formulaire de candidature, la protection anti-robot Cloudflare Turnstile transmet à Cloudflare des informations techniques, dont l’adresse IP et les caractéristiques du navigateur, pour vérifier que la demande n’est pas automatisée. Son jeton de vérification reste en mémoire. Selon les réglages de sécurité de l’hébergement, Cloudflare peut également émettre un cookie de validation cf_clearance ; sa présence et sa durée dépendent de ces réglages. Cette protection ne constitue pas une autorisation de suivi publicitaire. Informations du prestataire : https://www.cloudflare.com/turnstile-privacy-policy/.',
    ],
    table: {
      headers: ['Nom / technologie', 'Usage et responsable', 'Durée', 'Déclenchement'],
      rows: [
        ['baitly_site_cookie_choice · localStorage', 'Baitly : choix, date, expiration et version de la notice. Aucun identifiant de suivi.', '6 mois à compter du choix ; un choix expiré est ignoré.', 'Clic sur Accepter ou Refuser sur le site vitrine.'],
        ['clenzy_site_lang · sessionStorage', 'Baitly : langue explicitement choisie sur le site vitrine.', 'Session de l’onglet.', 'Changement de langue.'],
        ['baitly_application · cookie HttpOnly, Secure', 'Baitly : accès sécurisé à un dossier de candidature prestataire, sur le chemin de son API.', '30 jours maximum ; supprimé à la clôture du parcours prévue par le service.', 'Création ou reprise d’une candidature.'],
        ['clenzy_auth / clenzy_refresh · cookies HttpOnly', 'Baitly : authentification et renouvellement de session PMS ; les identifiants ne sont pas accessibles au JavaScript.', 'Jusqu’à l’expiration des jetons de session ; supprimés à la déconnexion. Replis techniques configurés : 24 h / 7 jours.', 'Connexion au PMS, pas à la simple visite du site vitrine.'],
        ['clenzy_session · cookie', 'Baitly : indique seulement qu’une session existe ; ne contient pas de jeton de connexion.', 'Alignée sur la session, plafonnée à 8 h ; supprimé à la déconnexion.', 'Connexion au PMS ; peut être visible sur le domaine parent et ses sous-domaines.'],
      ],
    },
  },
  en: {
    id: 'cookies', heading: '10. Cookies and browser storage',
    paragraphs: [
      'The Baitly public website only uses cookies and storage necessary for requested services. No audience measurement tool, advertising pixel or social media tracker is enabled there. Fonts, illustrations and demonstrations are hosted with the site. Necessary cookies fall within the consent exemption under Article 82 of the French Data Protection Act; they are not used to track browsing for advertising.',
      'The “Manage cookies” notice makes Accept and Refuse equally easy. In the current configuration, both choices leave only the necessary storage listed below. Accepting does not authorise any future tool: any new purpose or tracking provider will require updated information and a new prior choice. Closing the notice, scrolling or continuing to browse never constitutes consent.',
      'Your choice and its timestamp are kept for six months in this browser and on this site origin, without an advertising identifier or account synchronisation. Refusal and acceptance have the same lifetime. Change or withdraw your choice at any time through “Manage cookies” in the public website footer. If the browser blocks storage, the choice applies to the current page and will be requested again on a subsequent visit.',
      'The notice is limited to the public website. It does not delete the cookies required for PMS sign-in or a provider application and does not authorise tracking in the PMS, on another domain or on another device. The legacy keys starting with “clenzy” below are technical names kept for Baitly compatibility. For questions or to exercise your rights, contact contact@baitly.fr.',
      'When enabled on the application form, Cloudflare Turnstile bot protection sends technical information, including the IP address and browser characteristics, to Cloudflare to verify that the request is not automated. Its verification token stays in memory. Depending on hosting security settings, Cloudflare may also issue a cf_clearance clearance cookie; its presence and lifetime depend on those settings. This protection does not authorise advertising tracking. Provider information: https://www.cloudflare.com/turnstile-privacy-policy/.',
    ],
    table: {
      headers: ['Name / technology', 'Purpose and operator', 'Duration', 'Trigger'],
      rows: [
        ['baitly_site_cookie_choice · localStorage', 'Baitly: choice, date, expiry and notice version. No tracking identifier.', '6 months from the choice; expired choices are ignored.', 'Clicking Accept or Refuse on the public website.'],
        ['clenzy_site_lang · sessionStorage', 'Baitly: language explicitly selected on the public website.', 'Tab session.', 'Changing the language.'],
        ['baitly_application · HttpOnly, Secure cookie', 'Baitly: secure access to a provider application, scoped to its API path.', 'Up to 30 days; removed at the closure step provided by the service.', 'Creating or resuming an application.'],
        ['clenzy_auth / clenzy_refresh · HttpOnly cookies', 'Baitly: PMS authentication and session renewal; credentials are not accessible to JavaScript.', 'Until session tokens expire; removed on logout. Configured technical fallbacks: 24 hours / 7 days.', 'PMS sign-in, not a simple public website visit.'],
        ['clenzy_session · cookie', 'Baitly: only signals an existing session; contains no sign-in token.', 'Matches the session, capped at 8 hours; removed on logout.', 'PMS sign-in; may be visible on the parent domain and subdomains.'],
      ],
    },
  },
  ar: {
    id: 'cookies', heading: '10. ملفات تعريف الارتباط وتخزين المتصفح',
    paragraphs: [
      'يستخدم موقع Baitly التعريفي فقط ملفات تعريف الارتباط والتخزين اللازمة للخدمات المطلوبة. لا تُفعّل فيه أدوات قياس الجمهور أو بكسلات الإعلان أو أدوات تتبع الشبكات الاجتماعية. تُستضاف الخطوط والصور والعروض مع الموقع. تُعفى الملفات الضرورية من الموافقة بموجب المادة 82 من قانون المعلوماتية والحريات الفرنسي، ولا تُستخدم لتتبع التصفح لأغراض إعلانية.',
      'تتيح نافذة «إدارة ملفات تعريف الارتباط» القبول والرفض بالسهولة نفسها. في الإعداد الحالي، يُبقي الخياران فقط التخزين الضروري الموضح أدناه. لا يسمح القبول بأي أداة مستقبلية؛ تتطلب أي غاية جديدة أو مزود تتبع جديد معلومات محدثة واختياراً مسبقاً جديداً. إغلاق النافذة أو تمرير الصفحة أو متابعة التصفح لا يُعد موافقة.',
      'يُحفظ اختيارك وتوقيته لمدة ستة أشهر في هذا المتصفح وعلى عنوان هذا الموقع، دون معرّف إعلاني أو مزامنة مع حسابك. مدة الرفض تساوي مدة القبول. يمكنك تعديل اختيارك أو سحبه في أي وقت من «إدارة ملفات تعريف الارتباط» في تذييل الموقع التعريفي. إذا منع المتصفح التخزين، يظل الاختيار سارياً في الصفحة الحالية ويُطلب مجدداً في زيارة لاحقة.',
      'تقتصر النافذة على الموقع التعريفي. ولا تحذف الملفات اللازمة للدخول إلى نظام إدارة العقارات أو لطلب مقدم خدمة، ولا تسمح بالتتبع في النظام أو على نطاق آخر أو جهاز آخر. المفاتيح القديمة التي تبدأ بـ «clenzy» أدناه أسماء تقنية محفوظة لتوافق Baitly. للأسئلة أو ممارسة حقوقك: contact@baitly.fr.',
      'عند تفعيل حماية Cloudflare Turnstile من الروبوتات في نموذج الطلب، تُرسل معلومات تقنية، منها عنوان IP وخصائص المتصفح، إلى Cloudflare للتحقق من أن الطلب ليس آلياً. يبقى رمز التحقق في الذاكرة. وقد تصدر Cloudflare أيضاً ملف تحقق cf_clearance بحسب إعدادات أمان الاستضافة؛ ويتوقف وجوده ومدته على تلك الإعدادات. لا تسمح هذه الحماية بالتتبع الإعلاني. معلومات المزود: https://www.cloudflare.com/turnstile-privacy-policy/.',
    ],
    table: {
      headers: ['الاسم / التقنية', 'الغرض والمشغّل', 'المدة', 'التفعيل'],
      rows: [
        ['baitly_site_cookie_choice · localStorage', 'Baitly: الاختيار وتاريخه وانتهاؤه وإصدار الإشعار. لا يوجد معرّف تتبع.', '6 أشهر من الاختيار؛ تُتجاهل الخيارات المنتهية.', 'النقر على قبول أو رفض في الموقع التعريفي.'],
        ['clenzy_site_lang · sessionStorage', 'Baitly: اللغة المختارة صراحة على الموقع التعريفي.', 'جلسة علامة التبويب.', 'تغيير اللغة.'],
        ['baitly_application · HttpOnly, Secure', 'Baitly: الوصول الآمن لطلب مقدم الخدمة، ضمن مسار واجهته البرمجية.', '30 يوماً كحد أقصى؛ يُحذف في مرحلة إغلاق المسار المحددة بالخدمة.', 'إنشاء طلب أو استئنافه.'],
        ['clenzy_auth / clenzy_refresh · HttpOnly', 'Baitly: المصادقة وتجديد جلسة نظام إدارة العقارات؛ لا يمكن لـ JavaScript الوصول إلى بيانات الاعتماد.', 'حتى انتهاء رموز الجلسة؛ تُحذف عند الخروج. المدد التقنية البديلة المهيأة: 24 ساعة / 7 أيام.', 'تسجيل الدخول إلى النظام، وليس مجرد زيارة الموقع التعريفي.'],
        ['clenzy_session · cookie', 'Baitly: يشير فقط لوجود جلسة؛ لا يحتوي على رمز دخول.', 'متوافقة مع الجلسة وبحد أقصى 8 ساعات؛ يُحذف عند الخروج.', 'الدخول إلى النظام؛ قد يظهر على النطاق الرئيسي ونطاقاته الفرعية.'],
      ],
    },
  },
};
