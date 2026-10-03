# Audit des visuels Baitly

Revue du 26 septembre 2026, sur le site marketing local. Le produit reste en pré-lancement : les logements, voyageurs et services des démonstrations sont illustratifs.

## Diagnostic et corrections

L’ancien catalogue réutilisait surtout le patio, la terrasse désertique, la chambre et la piscine sur des sujets sans lien. La piscine existait aussi dans plusieurs formats, ce qui masquait certaines répétitions.

| Surface | Correction apportée |
| --- | --- |
| Accueil | Scène d’accueil générée avec le planning Baitly à l’écran dans le hero. L’ancienne villa illustre désormais uniquement l’accès aux ressources. Vue réelle de Riyad pour le marché saoudien, autre maison pour la conclusion. Les trois logements du planning ont leurs propres photos. |
| Agents IA | Accueil hôtelier dans l’introduction, travail sur ordinateur pour la partie éditoriale et examen collectif d’un dossier auprès des étapes. Appartement identifié dans la démo. |
| Revenue et market data | Hébergement lumineux dans l’introduction, analyse de graphiques pour la partie éditoriale et revue de performances auprès des étapes. |
| Paiements et finances | Paiement par carte dans l’introduction, comptabilité et reçus pour la partie éditoriale, vérification de comptes auprès des étapes. Chambre distincte pour le séjour facturé. |
| Opérations et ménage | Préparation des oreillers dans l’introduction, linge de lit pour la partie éditoriale et chariot de ménage auprès des étapes. Chambre remise en état pour la preuve de mission. |
| Objets connectés | Équipements physiques dans l’introduction, serrure commandée par téléphone pour la partie éditoriale et clavier de contrôle d’accès auprès des étapes. Entrée de logement propre à la démonstration. |
| Portail propriétaire | Clés dans l’introduction, documents pour la partie éditoriale et signature accompagnée auprès des étapes. Logement distinct pour le relevé. |
| PMS et channel manager | Nouveau riad, six logements visuellement distincts dans le planning, arrivée et intervention illustrées séparément. |
| Booking engine | Deux chambres différentes, villa cohérente entre sélection et réservation, extras montrant réellement le repas, le petit-déjeuner, le chef, le ménage ou le départ tardif. Un transfert conserve son pictogramme. |
| Livret d’accueil | Appartement avec deux vues du salon et une cuisine ; montgolfière, dîner dans un campement et préparation culinaire. Le téléphone et la parallaxe sont conservés. |
| Migration | Un riad dédié, reconnaissable entre l’aperçu d’import et la fiche de logement. Les historiques voyageurs utilisent des initiales. |
| Tarifs | Images propres aux exemples de logements et au site de réservation. |
| Solutions | Réception, appartement d’hôte, patio de riad et portefeuille immobilier, selon le métier. |
| Ressources et carnet | Lecture et documents pour le centre de ressources ; photos spécifiques aux articles de calcul, extras et opérations. |
| Prestataires | Plomberie pour la maintenance et machines de blanchisserie pour le linge. Cuisine, entretien, jardinage et remise des clés conservent leurs visuels pertinents. |
| Pré-lancement | Réception hôtelière, en cohérence avec les professionnels visés. |
| Menus | Les aperçus de produits reprennent leur contexte réel : livret, preuve de ménage, propriétaire ou article. Les mini-interfaces et logos pertinents sont conservés. |
| Pages sans photos | Contact, comparaison, démo d’orientation, outils de ressources, statut et pages juridiques restent centrés sur leur contenu et leurs interfaces. Aucun remplissage décoratif ajouté. |

Les portraits de banque d’images attribués à plusieurs voyageurs fictifs ont été remplacés par des initiales dans le planning, l’accueil, la migration et les cartes PMS.

Depuis le 3 octobre 2026, les deux démonstrations animées du planning réutilisent les 12 portraits locaux de `../guests/`, à la demande du produit. Chaque portrait est associé à un seul voyageur fictif et cette association reste identique entre le planning, la vue Agents IA et leur projection dans le moniteur de l’accueil. Le composant partagé `GuestAvatar` conserve les initiales pour les voyageurs sans photo et en cas d’échec de chargement. Ces vignettes illustratives ne représentent pas des clients réels ni des témoignages.

## Catalogue et sources

- 72 photographies issues de sources distinctes et une scène générée pour le hero. Cette dernière possède deux résolutions WebP, soit 74 fichiers au total. La passe d’équilibrage des six pages produit avait ajouté 12 photos au catalogue initial de 60.
- Largeur limitée selon l’usage, entre 320 et 1 254 pixels. Environ 5,64 Mio pour l’ensemble du catalogue, répartis sur les pages ; ce n’est pas le poids chargé à chaque visite.
- Les fichiers sont servis par le site, sans dépendance d’affichage à une URL de banque d’images.
- `sources.json` consigne la provenance et le poids des fichiers. Pour les photographies, il indique le photographe, la page d’origine, l’URL de téléchargement et la [licence Unsplash](https://unsplash.com/license). Ces sélections proviennent du catalogue gratuit, hors Unsplash+. Pour la scène générée, il référence le [prompt et le mode de création](home-reception-prompt.md).
- `../../data/baitlyPhotography.ts` centralise les affectations et les descriptions françaises, anglaises et arabes. Les photos éditoriales ont un texte alternatif descriptif ; les vignettes accompagnées d’un libellé équivalent restent décoratives pour éviter une double lecture.

Les anciens fichiers devenus inutilisés ne sont pas supprimés pendant cette passe. Ils ne sont plus importés par ces surfaces et ne sont donc plus embarqués dans le build du site.

## Règle de réutilisation

Une photo éditoriale a un sujet et une affectation propres. Ne pas utiliser une photo d’ambiance pour remplacer un visuel métier manquant.

La continuité reste volontaire pour **le même élément** : logement sélectionné puis confirmé, offre affichée puis ajoutée au panier, miniature du menu annonçant ce même produit, photo de contrôle de la même mission. Les logos de marque peuvent naturellement se répéter. Les photos ne constituent ni des témoignages clients ni une preuve de partenariat.

Avant un prochain ajout, vérifier le sujet réel, le contexte géographique si un lieu est annoncé, les fichiers existants, le recadrage mobile et la source. Ajouter la provenance au manifeste et une description aux trois langues.

## Équilibre des six pages produit

Les pages Agents IA, Revenue, Paiements, Opérations, Objets connectés et Portail propriétaire conservent leurs démonstrations et leurs palettes. Chacune reçoit un bandeau photo compact sous les actions d’introduction et une photo dédiée dans la section des étapes. Cette dernière associe désormais un texte numéroté sur fond coloré et une grande image, côte à côte sur ordinateur et tablette, puis empilés sur mobile. Les photos des étapes sont chargées à la demande ; les textes alternatifs existent en français, anglais et arabe.

## Vérification

- Fichiers décodables, dimensions et tailles vérifiées, sources et empreintes distinctes.
- TypeScript et build du site validés.
- Revue des routes avec photos dans le navigateur ; vérification des recadrages et de l’absence de débordement aux largeurs 375, 768, 1 024 et 1 440 pixels sur les surfaces représentatives.
- 100 tests existants des parcours de réservation, upsells, planning, livret, démos métier, navigation et langues validés au total. Après des dépassements de délai en parallèle, le booking a été relancé séquentiellement et le planning seul avec un plafond temporaire de 60 s en CLI ; aucune modification des tests pour cette passe.
- Passe d’équilibrage : TypeScript et build validés ; 29 tests existants des démos métier et de parité des langues réussis. Les six pages ont été inspectées dans le navigateur, avec contrôles représentatifs à 375, 768, 1 024 et 1 440 pixels. Les sujets photographiés restent visibles et aucun débordement global n’a été constaté.

Aucun commit, push ou déploiement dans cette passe.

## Hero et accès aux ressources

La scène de réception utilise l’outil Imagegen intégré avec une capture du planning Baitly fournie par l’utilisateur comme référence. Le visuel est présenté comme une illustration générée, sans témoignage ni client réel. La photo conserve son cadrage carré sur mobile afin de garder visibles l’hôte et l’écran. Deux variantes optimisées sont servies via `srcset` : 720 px (75 Kio) et 1 254 px (157 Kio).

L’ancien visuel de villa reste sur la seule nouvelle section Ressources de l’accueil, à côté des aperçus du calculateur et du guide des obligations. Il n’est plus utilisé dans le hero.
