# Taxe de séjour et paramètres fiscaux

## Comment configurer la taxe de séjour dans Baitly ?

La taxe de séjour se configure dans Paramètres, onglet Fiscal, section « Barèmes de taxe de séjour » (la modification est réservée aux administrateurs — super admin et super manager). Vous saisissez vos barèmes communaux : un barème par défaut pour toute l'organisation, et si besoin des barèmes spécifiques par logement (le barème par défaut s'applique à tous les logements qui n'ont pas de barème propre). Chaque barème précise la commune et son code INSEE, le mode de calcul, le tarif, les éventuelles surtaxes et son statut actif ou inactif. Attention : sans aucun barème configuré, la taxe de séjour n'est calculée pour aucune réservation. Un barème peut aussi prévoir un nombre maximal de nuits taxées et l'exonération des mineurs de moins de 18 ans, conformément à la réglementation française.

## Quels modes de calcul de taxe de séjour sont disponibles ?

Trois modes couvrent les cas français : pour un hébergement classé, le mode « montant fixe par personne et par nuit » (vous saisissez le tarif communal par personne) ; pour un hébergement non classé, le mode « au réel » en pourcentage du prix de la nuitée par personne, avec un plafond par personne et par nuit ; et un mode forfaitaire par nuit. À cela s'ajoutent les taxes additionnelles : la taxe départementale (typiquement 10 pour cent du montant) et, le cas échéant, la taxe additionnelle régionale. L'option d'exonération des mineurs retire automatiquement les moins de 18 ans du calcul. Renseignez le barème publié par votre commune (délibération municipale) : Baitly applique ensuite le calcul automatiquement à chaque réservation.

## Comment la taxe de séjour est-elle calculée sur une réservation ?

Le calcul est automatique dès qu'un barème s'applique au logement : Baitly détermine la taxe à partir du nombre de personnes, du nombre de nuits, du prix et du mode du barème (montant fixe, pourcentage plafonné ou forfait), en ajoutant les surtaxes départementale et régionale et en appliquant l'exonération des mineurs si activée. Sur le moteur de réservation direct, la taxe de séjour apparaît comme une ligne distincte dans le détail du prix présenté au voyageur (à côté du sous-total et des frais de ménage) et elle est encaissée avec le séjour, puis reprise sur la facture. Pour les réservations venant de plateformes qui collectent et reversent elles-mêmes la taxe (comme Airbnb dans la plupart des communes françaises), c'est la plateforme qui gère la collecte : rapprochez-vous du canal concerné pour savoir qui collecte quoi.

## Comment déclarer la taxe de séjour (rapport par période) ?

La section taxe de séjour propose un « Rapport par période » conçu pour votre déclaration : choisissez les dates « Du » et « Au », puis générez le rapport. Il liste les réservations confirmées dont le départ tombe dans la période, avec pour chacune le logement, le voyageur, la date de départ, le nombre de nuits, le nombre de personnes, la commune et la taxe calculée, ainsi que le total collecté. Un export CSV permet de transmettre ou retraiter les données pour la déclaration auprès de votre commune. Si certaines réservations de la période n'ont aucun barème applicable, un avertissement le signale : elles ne sont pas comptées dans le rapport — pensez à compléter vos barèmes puis à régénérer le rapport.

## Comment configurer le profil fiscal de mon organisation ?

Dans Paramètres, onglet Fiscal (réservé aux administrateurs), le profil fiscal définit l'identité fiscale de votre organisation : pays, devise, régime fiscal, numéro fiscal, numéro de TVA et assujettissement à la TVA avec sa fréquence de déclaration, raison sociale et adresse légale, langue des factures, préfixe de numérotation et mentions légales. Ces informations alimentent directement vos factures (mentions légales, coordonnées vendeur) et la conformité de la facturation. Une section « règles de taxe » permet de gérer les taux de TVA par catégorie de prestation, avec un nom de taxe, un taux en pourcentage, un pays et une période de validité.

## Comment suivre mes montants de TVA (reporting fiscal) ?

Le reporting fiscal restitue vos totaux par période — mensuelle, trimestrielle ou annuelle : nombre de factures, total hors taxes, total de taxes et total TTC, avec le détail par catégorie et par taux (base imposable, montant de taxe, nombre de lignes). Il sert de base à vos déclarations de TVA et au contrôle de cohérence avec votre comptabilité. Pour aller plus loin, la page Facturation propose des exports comptables (CSV, export FEC pour l'administration fiscale française) et la page Factures récapitule les montants HT, TVA et TTC de chaque document.

## Questions fréquentes

**Pourquoi la taxe de séjour n'apparaît-elle pas sur mes réservations ?**
Aucun barème ne s'applique probablement au logement : vérifiez dans Paramètres, onglet Fiscal, qu'un barème par défaut ou un barème propre au logement est configuré et actif.

**Mon logement n'est pas classé, quel mode choisir ?**
Le mode « au réel » : un pourcentage du prix de la nuitée par personne, plafonné par personne et par nuit selon le tarif de votre commune.

**Les enfants paient-ils la taxe de séjour ?**
Non si l'option d'exonération des mineurs est activée sur le barème : les moins de 18 ans sont exclus du calcul.

**Airbnb collecte déjà la taxe : dois-je la déclarer aussi ?**
Dans la plupart des communes françaises, Airbnb collecte et reverse directement. Votre rapport Baitly sert alors surtout pour les réservations directes et les canaux qui ne collectent pas.

**Qui peut modifier les barèmes et le profil fiscal ?**
Les administrateurs (super admin et super manager). Les autres rôles n'ont pas accès à l'onglet Fiscal des paramètres.
