# Portabilité des données chez les PMS concurrents (octobre 2026)

Enquête du 6 octobre 2026 : sources éditeurs (CGU, centres d'aide, docs API) et retours
d'utilisateurs publiés (Capterra, Trustpilot, forums éditeurs, communauté Airbnb).
Les données affichées sur le site vivent dans `pmsPortability.ts` (même dossier).

> Limite de méthode : les pages Trustpilot, Guesty, Hostaway et Lodgify n'étaient pas
> accessibles en direct depuis l'environnement de recherche. Les citations proviennent des
> extraits indexés par le moteur de recherche. Relire chaque source avant une campagne.
> Reddit et les groupes Facebook n'ont rien donné d'exploitable via la recherche indexée.

## 1. Synthèse

- **Aucun PMS ne publie un « export intégral du compte » en un clic.** Partout, la sortie
  passe par plusieurs exports séparés : réservations, voyageurs, finances, avis, tâches.
  Les messages, pièces jointes, photos, modèles et règles de tarification ne sont quasiment
  jamais exportables. Ils sont à recréer.
- **Le format dominant est CSV/Excel.** Le JSON n'est disponible que via les API
  (Smoobu, Guesty, Hostaway, Beds24, OwnerRez, Lodgify, Hostfully, Hospitable, Avantio).
- **Le vrai risque, c'est la perte d'accès à la résiliation.** Hostaway, OwnerRez,
  Beds24, Hostfully et SuperHote coupent l'accès (ou suppriment les données) à la
  fermeture du compte. Seul Smoobu publie une fenêtre de 30 jours après la résiliation.
  Hospitable laisse un accès en lecture seule pendant une durée non garantie.
- **Les délais publiés concernent la résiliation, pas l'export.** Exports en libre-service
  instantanés ou envoyés par email (SuperHote, Hospitable, Smoobu au-delà de 300
  réservations). Le délai réel, ce sont l'engagement et le préavis (Guesty : 13 mois +
  30 jours ; Amenitiz : 1 an + 3 mois ; Hostaway : 30 jours).
- **Les plaintes portent surtout sur l'engagement et la facturation de sortie**
  (Guesty, Hostaway, Lodgify, Avantio). On trouve aussi un avis Capterra sur Guesty
  (« accès aux données presque impossible… pris en otage ») et une demande d'aide à
  l'extraction restée sans suite chez Lodgify.
- **Contexte marché :**
  - Airbnb a retiré en septembre 2026 l'export CSV opérationnel des réservations. Des hôtes
    protestent sur le forum communautaire.
  - Guesty For Hosts a fermé le 31 mai 2026, sans export possible après cette date.
  - Le Data Act européen (Chapitre VI, applicable depuis le 12 septembre 2025) impose aux
    services cloud un préavis de 2 mois maximum et une transition de 30 jours. Les frais de
    changement de fournisseur seront interdits à partir du 12 janvier 2027.

## 2. Fiche par PMS

| PMS | Export autonome | API | Accès après résiliation | Engagement / frais | Indicateur |
|---|---|---|---|---|---|
| SuperHote | Partiel : CSV réservations par email. Emails Airbnb/Booking exclus depuis mars 2026 | Non documentée | Non : suppression irréversible sous 5 jours ouvrés | Non documenté | Peu documenté |
| Smoobu | Oui : CSV/Excel/PDF, contacts à part | Oui | **Oui : 30 jours** (données voyageurs supprimées sous 120 jours) | Non documenté | Facilité |
| Guesty | Partiel : rapports CSV, séjours propriétaires à part | Oui (dont endpoint CSV) | Non documenté | **Non** : 13 mois, reconduction 12 mois, préavis 30 jours, frais de résiliation anticipée | Contraignant |
| Hostaway | Partiel : plusieurs exports CSV | Oui | **Non** : « pas de conservation après désactivation » | Partiel : résiliation sous 30 jours, durée selon contrat | À préparer |
| Beds24 | Oui : CSV | Oui (V2) | Non | Oui : résiliation autonome à tout moment | Facilité |
| OwnerRez | Oui : Excel/CSV/TSV par liste | Oui | Non : fermeture immédiate | Oui : sans contrat ni frais | Facilité |
| Lodgify | Partiel : rapports CSV/PDF | Oui | Non documenté | Partiel : offres annuelles, avis sur l'absence de remboursement au prorata | À préparer |
| Hostfully | Partiel : rapports CSV/HTML/PDF | Oui | Non : fin de la période payée | Oui : résiliation autonome | À préparer |
| Hospitable | Partiel : selon l'offre, exports séparés | Oui | Partiel : lecture seule temporaire | Oui : effet en fin de période | Facilité |
| Amenitiz | Partiel : clients en XLSX (pas de CSV), factures | Non documentée | Non : données supprimables à la fin du contrat | **Non** : 1 an, demande 3 mois avant | Contraignant |
| Avantio | Non documenté | Oui | Non documenté | Non documenté | Peu documenté |

Règle de l'indicateur (`exitLevel`) : oui = 2 points, partiel = 1, non ou non documenté = 0.
Au moins 2 critères non documentés → « peu documenté ». Sinon : 6 points ou plus →
« facilité », 4 ou 5 → « à préparer », moins de 4 → « contraignant ». L'indicateur ne mesure
que ce qui est documenté. Il ne juge pas les intentions d'un éditeur. C'est ce qui le rend
défendable au regard des règles françaises sur la publicité comparative (art. L122-1
C. conso : comparaison objective et vérifiable).

## 3. Retours d'utilisateurs retenus

- **Guesty** : avis Capterra « Stay away from this ». L'auteur décrit un accès aux données
  « nearly impossible… held hostage » et des tickets clos par des bots. Sur Trustpilot,
  d'autres avis citent des prélèvements pendant plusieurs mois après résiliation.
- **Hostaway** : avis Trustpilot/Capterra. Engagement annuel découvert au départ, double
  facturation pendant la résiliation, préavis de 30 jours non levé.
- **Lodgify** : Trustpilot. Reconduction annuelle sans remboursement au prorata. Un client
  premium n'a pas reçu d'aide concrète pour extraire ses données.
- **OwnerRez** : forum de demandes de fonctionnalités. Les utilisateurs réclament un export de
  tous les voyageurs, tags et avis compris.
- **Smoobu** : avis comparatifs. Exports comptables peu structurés, à retravailler dans Excel.
- **Avantio** : Capterra/comparateurs. Difficultés d'échange de données, pas de remboursement
  après une résiliation anticipée.
- **Airbnb (contexte)** : threads « Disappearance of the Operational Reservation CSV
  Export » et « Please Restore All Reservations… ». Airbnb invoque la protection des données
  et ne propose plus que l'export des revenus.

## 4. Ce qui a été livré sur le site

- Le sélecteur PMS est désormais **sur la page d'accueil** (`BaitlyPmsHomeSection`), en plus
  de `/migration`. Pour chaque PMS, il montre :
  - les formats ;
  - un indicateur de facilité de départ fondé sur 4 critères ;
  - un tableau « votre PMS / Baitly » ;
  - les conditions de sortie publiées ;
  - les retours d'utilisateurs, signalés comme non vérifiés ;
  - des sources typées (CGU, avis, forum) ;
  - une fiche de préparation téléchargeable.
- Amenitiz a été ajouté. Les fiches Smoobu, Guesty, Hostaway, Lodgify, Hostfully et Avantio
  ont été enrichies.
- L'engagement de réversibilité a été renforcé : « Baitly ne retient aucune donnée… ni frais
  de sortie, ni export partiel, ni engagement annuel » et « au moins 30 jours après la
  résiliation ».

**À valider côté direction** : « 30 jours minimum après résiliation » et « sans frais de
sortie » sont des engagements commerciaux nouveaux. « Mensuel, sans engagement annuel »
reprend la FAQ fidélité existante. Le statut « pré-lancement » reste affiché tant que l'export
intégral n'existe pas.

## 5. Adapter Baitly pour anticiper la migration : état au 7 octobre 2026

Les six recommandations sont implémentées (détails techniques : `server/.../service/migration/README.md`) :

1. **Profils éditeurs** : la source choisie (Smoobu, Beds24, Hostaway, Guesty, Hospitable, OwnerRez,
   Baitly) pré-remplit les correspondances à partir des noms de champs des API. Les exports écran
   restent à valider sur des échantillons réels de prospects.
2. **Connecteurs API (bêta)** pour ces six PMS, en lecture seule. Les identifiants ne sont jamais
   stockés ; le résultat passe par le même aperçu que les fichiers.
3. **Nouveaux types** : avis, tarifs par nuit et tâches deviennent des données Baitly ; frais de
   ménage, taxe de séjour et taxes sont repris. Les demandes et refus sont comptés, pas bloquants.
   Propriétaires et relevés restent en archive (les comptes propriétaires passent par invitation).
4. **Réservations sans email** : le channel manager adopte la réservation importée (code OTA) au
   lieu de la doubler, et complète email et téléphone.
5. **Plan de bascule** dans Paramètres → Migration PMS : échéances de résiliation et d'export,
   onze étapes cochables, l'import étant détecté automatiquement.
6. **Export intégral Baitly** en libre-service : ZIP avec CSV réimportables, JSON complet, photos,
   fichiers d'import d'origine et manifeste SHA-256.

Reste à faire : valider chaque connecteur sur un compte réel, et appliquer la fenêtre de 30 jours
après résiliation quand le flux de résiliation d'organisation existera.

## Sources principales

- SuperHote : [export](https://helpcenter.superhote.com/fr/article/comment-exporter-les-reservations-superhote-ekmxl2/), [suppression du compte](https://helpcenter.superhote.com/fr/article/supprimer-son-compte-superhote-1ci09k5/)
- Smoobu : [CGU (30 jours)](https://www.smoobu.com/en/terms/), [export](https://support.smoobu.com/hc/en-us/articles/360010511879-Download-or-export-your-bookings-list)
- Guesty : [CGU](https://www.guesty.com/terms-of-service/), [Guesty For Hosts, fermeture](https://help.guestyforhosts.com/hc/en-gb/articles/33057135657373-Preparing-to-Disconnect-Guesty-for-Hosts), [avis Capterra](https://www.capterra.com/p/159377/Guesty/reviews/)
- Hostaway : [résiliation](https://support.hostaway.com/hc/en-us/articles/14006214140699-Cancel-Your-Hostaway-Account), [Trustpilot](https://www.trustpilot.com/review/www.hostaway.com)
- Beds24 : [Q&A résiliation](https://wiki.beds24.com/index.php/Questions_and_Answers)
- OwnerRez : [fermeture](https://www.ownerrez.com/support/articles/closing-your-account), [forum export](https://www.ownerrez.com/forums/requests/export-all-guest-data-including-tags-reviews)
- Lodgify : [CGU](https://www.lodgify.com/terms/), [Trustpilot](https://uk.trustpilot.com/review/lodgify.com?page=5)
- Hostfully : [résiliation](https://help.hostfully.com/en/articles/1695060-cancel-your-hostfully-subscriptions)
- Hospitable : [résiliation](https://help.hospitable.com/en/articles/13783126-cancel-or-pause-your-hospitable-subscription)
- Amenitiz : [export clients](https://support.amenitiz.com/en/articles/332712-how-to-export-your-clients-list), [résiliation](https://support.amenitiz.com/en/articles/429634-how-to-cancel-your-amenitiz-subscription), [CGV](https://amenitiz.com/en/legal/terms-conditions)
- Avantio : [API](https://www.avantio.com/api-integrations/), [Capterra](https://www.capterra.com/p/134278/Avantio/)
- Airbnb : [retrait de l'export CSV](https://community.withairbnb.com/t5/Help-with-your-business/Disappearance-of-the-Operational-Reservation-CSV-Export-A-Major/m-p/2293756)
- Data Act : [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/law-in-tech/2026/cloud-exit-under-the-eu-data-act), [Greenberg Traurig](https://www.gtlaw.com/en/insights/2025/9/cloud-switching-under-the-eu-data-act)
