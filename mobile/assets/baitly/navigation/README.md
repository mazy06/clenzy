# Images de navigation Baitly

Huit PNG transparents générés avec l’outil intégré `image_gen`, le 12 octobre 2026. Les originaux sont conservés dans `/Users/toufik/.codex/generated_images/01a12e1e-aed7-7021-8a47-987cf8fab8b0/`. Les copies ci-dessous sont utilisées directement par l’application, sans retouche : 1254 × 1254 px, canal alpha conservé.

| Fichier | Fonction |
|---|---|
| `baitly-marketplace.png` | Services : boutique miniature |
| `baitly-properties.png` | Logements : maison et clé |
| `baitly-tracking.png` | Suivi : checklist |
| `baitly-account.png` | Compte : profil sculptural |
| `baitly-today.png` | Accueil / planning : calendrier |
| `baitly-missions.png` | Missions : boîte à outils |
| `baitly-network.png` | Réseau : maillons |
| `baitly-messages.png` | Messages : bulles de discussion |

Les références de style sont les images PMS `client/public/images/connected-devices/baitly-keybox.webp` et `client/public/images/connected-rooms/baitly-bedroom-thumb.webp`. La référence de mouvement fournie par le produit est [Menu Animation](https://dribbble.com/shots/21345665-MENU-ANIMATION).

## Prompt commun

Use case: stylized-concept. Asset type: Baitly mobile bottom navigation image, standalone transparent PNG. Generate a NEW single [subject]. Match the sculptural 3D, realistic miniature product render style of the supplied Baitly PMS references (reference images are style guides only, do not reproduce their actual subjects). Matte midnight navy #1B2A35, warm ivory, restrained brushed brass, natural soft studio light from upper left, three-quarter front camera with only slight top view, rounded physical edges, credible tactile materials. Square canvas. Object centered and filling 72 percent of canvas, complete silhouette unclipped, no ground, no base platform, no environment, genuinely transparent surrounding area, no cast shadow outside silhouette. No text, letters, logos, watermark, no gradients or neon. Extremely clear silhouette at 36px: minimal detail, broad forms, no thin fragile lines. Ready for UI motion: generous transparent padding on every side so lifting 8px, tilting 5 degrees, and scaling up 12 percent never clips the object. Neutral resting pose, visual center consistent with the other icons in this series.

`transparent_background: true` pour chaque génération.

## Sujets utilisés

- Marketplace: a miniature premium artisan market storefront, navy fabric awning with three broad folds, ivory storefront body, tiny brass service bell beside its single open counter. One compact recognizable storefront silhouette.
- Properties: a single miniature ivory contemporary house, warm sand pitched roof, one navy front door, one broad navy window, a tiny brass key leaning against the house base. A simple house silhouette.
- Tracking: a thick ivory clipboard with a brass top clip and three broad navy checklist marks, one prominent brass checkmark hovering just in front of the lower corner. Single compact upright clipboard silhouette.
- Account: a single sculptural profile bust, circular ivory head and rounded navy shoulders, backed by a small rounded ivory profile card with a brass rim. No realistic face. Clear person/profile silhouette.
- Today: a compact miniature desk calendar with an ivory body, two brass binding rings, navy top strip and six broad square day insets, one brass selected day square. No letters or numbers.
- Missions: a compact open navy technician toolbox with a brass handle, one large ivory wrench leaning diagonally inside and one folded ivory towel tucked at the edge, restrained and simple tools/work silhouette.
- Network: two interlocking chunky chain links, one navy and one ivory with a brass connecting collar, soft squared rounded geometry. Clearly identifiable connected private network symbol, single compact silhouette.

## Prompt Messages

Use case: stylized-concept. Asset type: Baitly mobile navigation transparent image. The reference image is ONLY a style guide. Create a NEW single compact sculptural pair of overlapping message bubbles, larger midnight navy rounded speech bubble in back and smaller warm ivory speech bubble in front, three broad brushed brass dots on the ivory bubble. Match the realistic miniature 3D product render, navy/ivory/brass tactile materials and soft upper-left studio light of the reference. Square canvas, centered clear silhouette at 36px, 72 percent of canvas occupied, ample transparent padding for lifting, tilting and scaling animations. Genuine alpha transparency, no floor or cast shadow, no environment, no text or letters, no logos, no watermark, no neon. Same slight three-quarter front camera as reference, no clipboard or checkmark.

Référence pour Messages : `baitly-tracking.png` générée dans cette série.

## Intégration et mouvement

`BaitlyTabBar.tsx` utilise un dock bleu nuit de 64 px, des images de 40 px et des libellés de 11 px séparés sous les images. La découpe circulaire est un vrai masque SVG transparent de rayon 27 px : aucun disque ivoire, aucun aplat derrière l’image active. Elle se déplace en 280 ms. L’image sélectionnée se soulève de 10 px, grandit et s’incline brièvement ; aucune animation permanente. Les écrans glissent en 240 ms. Le réglage système Réduire les animations supprime ces mouvements. Les images sont décodées à la taille d’affichage sur iOS (`enforceEarlyResizing`). Les zones tactiles, marges de sécurité, badges de messages et événements `tabPress`/`tabLongPress` sont conservés.

Visiteur : Services / Logements / Suivi / Compte. Propriétaire : Accueil / Logements / Services / Suivi / Compte. Prestataire : Missions / Services / Demandes ou Réseau / Compte. Les parcours historiques utilisent également la barre partagée.
