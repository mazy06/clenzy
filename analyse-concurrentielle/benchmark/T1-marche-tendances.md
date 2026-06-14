# T1 — Note de contexte Marché & Tendances (STR / PMS)

> Agent transverse « Marché & Tendances » — analyse concurrentielle Clenzy.
> Date de rédaction : **2026-06-13**. Toutes les sources sont datées et notées en confiance.
> Cible Clenzy : conciergeries / gestionnaires pro B2B2C + propriétaires multi-biens, ancrage **France** (ambition Maroc / KSA non activée).

---

## 1. Périmètre & méthode

**Objet.** Cadrer le contexte marché 2024-2026 de la location courte durée (STR / *short-term rental*) et de l'édition de PMS (*Property Management System*), pour alimenter la stratégie produit et commerciale de Clenzy.

**Méthode.**
- Recherche web (juin 2026), priorité aux sources primaires (Légifrance, EUR-Lex, Commission européenne, communiqués d'entreprises, presse spécialisée : Skift, PhocusWire, ShortTermRentalz, TechCrunch, Rental Scale-Up).
- Chaque fait est **daté (mois/année) + sourcé (URL) + noté en confiance** : `Confirmé` (source primaire ou plusieurs sources concordantes), `Probable` (source secondaire crédible, non recoupée), `À vérifier` (donnée isolée, à confirmer avant décision).
- Échelle d'impact stratégique : **1 = faible, 2 = moyen, 3 = fort**. Horizon : **Now** (≤ 6 mois), **Next** (6-18 mois), **Later** (> 18 mois).

**Limites.** Les données de parts de canaux et les chiffres de marché proviennent souvent de rapports d'éditeurs (Guesty, Hostaway, PriceLabs) — biais commercial possible, d'où la note `Probable` sur la plupart. Aucun chiffre n'a été inventé ; les zones non documentées sont signalées comme telles.

---

## 2. Tendances secteur STR

### 2.1 Consolidation des PMS et des opérateurs (vague d'acquisitions 2024-2025)

Le marché entre dans une phase de **consolidation accélérée**, où l'échelle s'achète par acquisition.

- **Hostaway** : levée de **365 M$ en décembre 2024** (lead General Atlantic, avec PSG), valorisation **925 M$** ; devient le **premier PMS STR « licorne » (valorisation 1 Md$) en octobre 2025**, après +50 % de croissance. Fonds fléchés vers l'expansion européenne et l'IA (outils de réservation directe, fonctionnalités IA). Fondée en 2015, présente dans 90+ pays. *(Confirmé — TechCrunch 12/2024, General Atlantic 12/2024, TravelDailyNews/Dealroom 10/2025)*
- **Casago acquiert Vacasa** : finalisée **avril 2025**, créant l'un des plus grands gestionnaires STR d'Amérique du Nord. *(Probable — openPR/rentalsunited 2025)*
- **HomeToGo acquiert Interhome** (2ᵉ plus grand gestionnaire STR d'Europe, ~40 000 logements / 28 pays) à **Migros** : accord 02/2025, **clôturé août 2025**, prix **150 M CHF + jusqu'à 85 M CHF différés jusqu'en 2029** (~200 M$). HomeToGo bascule d'un « Kayak du STR » grand public vers une **plateforme B2B** (HomeToGo_PRO devient sa 1ʳᵉ ligne de métier). *(Confirmé — Skift 29/08/2025, Crunchbase 23/01/2025, PhocusWire 2025)*
- **Hostaway acquiert Tokeet** (juillet 2025) pour étendre sa distribution multicanale. *(Probable — openPR 2025)*

**Implication Clenzy.** Le segment se professionnalise et se capitalise : un acteur FR de niche doit défendre un **angle différenciant non réplicable par la scale** (conformité FR/UE native, ancrage conciergerie, terrain) plutôt que de courir la course aux features généralistes. La consolidation crée aussi une fenêtre : des gestionnaires acquis migrent de plateforme et cherchent des alternatives locales. **Confiance : Probable.**

### 2.2 Montée de l'IA agentique (messagerie, pricing, opérations)

L'IA passe du *gadget* au **cœur de plateforme** chez tous les leaders en 2024-2025.

- **Guesty** se repositionne « *built on AI* » avec des **agents IA** automatisant la messagerie invité et l'optimisation de revenu. *(Probable — guesty.com 2025-2026)*
- **Lodgify** lance en **avril 2025** un moteur de pricing IA + assistant de messagerie automatisé. *(Probable — produit annoncé 04/2025)*
- Acteurs IA-natifs : **Jurny** (réseau d'agents IA spécialisés : comms, opérations, revenu, avis), **Enso Connect** (système multi-agentique), **HostBuddy AI** (messagerie). *(Probable — sites éditeurs 2025-2026)*
- Effets revendiqués (à manier avec prudence, source éditeurs) : **+15-30 % de revenu** via pricing dynamique IA, **-30-50 % d'effort opérationnel**, **+20 % d'occupation**. *(À vérifier — chiffres marketing PriceLabs/éditeurs)*
- Adoption outillage : **96 %** des hôtes STR jugent la tech « critique », **90 %+** utilisent un PMS, **70 %** un outil de pricing dynamique. *(À vérifier — enquête citée par Hostaway/Lodgify 2025)*

**Implication Clenzy.** Clenzy possède déjà un assistant LLM multi-provider + RAG (cf. CLAUDE.md) : atout de timing. Le risque n'est pas l'absence d'IA mais la **banalisation** — la différenciation se jouera sur des agents *spécialisés métier FR* (réponse réglementaire, génération de docs NF/Factur-X, dispatch terrain) plutôt que sur une messagerie invité générique déjà commoditisée. **Confiance : Probable.**

### 2.3 Pression sur le *direct booking* vs OTA, mais dépendance OTA structurelle

- Part des canaux 2025 (enquête sectorielle citée) : **Airbnb ~45 %**, **direct ~20-28 %** (le direct aurait grimpé à 28 %), **Vrbo ~15 %**, **Booking.com ~14 %**. *(À vérifier — enquête éditeur PriceLabs/Guesty 2025, chiffres variables selon source)*
- **~77 % du revenu des invités récurrents** transiterait encore par les OTA → **1 Md$/an** de commissions OTA payées **sur des clients déjà acquis** (12-20 % de commission). *(Probable — ShortTermRentalz / Guesty 2025)*

**Implication Clenzy.** Le *direct booking* est un argument de marge fort pour les gestionnaires pro. Clenzy dispose déjà d'un **Booking Engine SDK embarquable** (cf. primer) : le valoriser comme levier de **dé-commissionnement** (récupérer le repeat-guest hors OTA) est un message commercial aligné sur une douleur chiffrée du marché. **Confiance : Probable.**

### 2.4 Co-hosting Airbnb — opportunité ET vecteur de désintermédiation des PMS

- Réseau **Co-Host d'Airbnb lancé en octobre 2024** (10 000 co-hôtes, 10 pays) ; en 2025 : **15 000+ co-hôtes, 100 000+ annonces, 10 M+ nuits réservées**, extension Japon/Corée. *(Probable — Guesty/Airbnb 8-K SEC FY2025)*
- Les biens co-hostés génèrent ~2× le revenu d'annonces comparables, 85 % en « Guest Favorite ». *(À vérifier — Guesty)*
- **Guesty supporte nativement** les relations de co-hosting Airbnb + redistribution vers Booking/Vrbo/direct. *(Probable — Guesty 2025)*

**Implication Clenzy.** Double lecture : (a) **opportunité** — formaliser dans Clenzy le modèle co-host (mandats, répartition de commission — Clenzy a déjà `ManagementContract` + facture de commission NF) colle exactement à la cible conciergerie ; (b) **menace** — Airbnb construit un *funnel* propriétaire→co-hôte qui peut court-circuiter les PMS tiers en internalisant la mise en relation et une partie de l'outillage. **Confiance : Probable.**

### 2.5 Internalisation OTA / partenariats d'écosystème (menace de désintermédiation)

- **Partenariat Airbnb–Guesty annoncé mars 2025** : intégration des workflows de gestion et channel management (calendriers, prix, avis). *(Probable — synthèse presse 03/2025)*
- Mouvement de fond : les leaders (Airbnb services, Booking) ajoutent des briques opérationnelles (services aux hôtes, co-hosting, distribution intégrée).
- **Note de confiance basse** : la recherche directe « OTA internalisant des fonctionnalités PMS comme menace pour les éditeurs tiers » **n'a pas renvoyé de source spécialisée affirmant explicitement cette thèse**. Le signal est **inféré** du co-hosting (§2.4) et des partenariats, pas documenté frontalement. *(À vérifier)*

**Implication Clenzy.** Surveiller le périmètre que les OTA absorbent (mise en relation, paiement, messagerie de base). La défense durable d'un PMS = ce que les OTA **ne veulent / ne peuvent pas** faire : trust accounting / reversements propriétaires, conformité fiscale FR, opérations terrain multi-prestataires, vue multi-canal agnostique. **Confiance : À vérifier (signal, pas fait établi).**

### 2.6 Bundling « all-in-one » vs unbundling best-of-breed

- Les PMS se vendent en **suite tout-en-un** (channel manager + pricing + messagerie + compta + ops), tandis qu'un **écosystème best-of-breed** persiste : pricing (**PriceLabs**), ménage/turnover (**Breezeway, Turno, Properly, Doinn, TIDY**), trust accounting (**VRTrust, CiiRUS, Escapia**). *(Probable — comparatifs Lodgify/Hostfully/Hostaway 2025)*
- Les éditeurs ajoutent un **« fintech embarqué »** (paiements, payouts) à la suite. *(Probable)*

**Implication Clenzy.** Choix d'architecture stratégique : Clenzy doit **intégrer nativement** les briques où la valeur FR est forte (compta/reversements, conformité, terrain) et **s'ouvrir par API** aux best-of-breed dominants (PriceLabs pour le pricing, apps de ménage) plutôt que tout réinventer (cf. règle interne « ne pas réinventer / Rule of Three »). **Confiance : Probable.**

### 2.7 Croissance du marché (toile de fond)

- STR valorisé **124,5 Md$ en 2024**, projeté **344 Md$ en 2034** (×2,7). *(À vérifier — rapport de marché cité par Hostaway, source unique)*
- Marché du logiciel PMS STR en croissance, **CAGR ~7,6 %** (estimation OpenPR/WiseGuy). *(À vérifier — rapports payants, chiffres divergents)*

**Implication Clenzy.** Marché porteur mais cible serrée par la régulation FR (cf. §4). La croissance se déplace vers le **professionnel / gestionnaire** (cible Clenzy), pas l'hôte amateur que la loi Le Meur dissuade. **Confiance : À vérifier.**

---

## 3. Attentes par segment

> Synthèse des critères d'achat dominants observés dans les comparatifs PMS 2025. Hiérarchisation = jugement d'analyste appuyé sur les sources, à valider par entretiens clients.

### 3.1 Propriétaire indépendant (1-3 biens)

- **Critères primants** : prix bas, simplicité, channel manager (sync Airbnb/Booking/Vrbo), messagerie automatisée, calendrier unifié, site de réservation directe simple.
- **Sensibilité** : coût (logiciels facturés au bien/mois, ex. ~16 $/bien chez certains éditeurs), courbe d'apprentissage.
- **Effet loi Le Meur (FR)** : segment **sous pression réglementaire et fiscale** (plafonds 120 nuits, abattements micro-BIC réduits — §4) → certains sortent du marché ou basculent en gestion déléguée.
- *(Probable — comparatifs Lodgify/Baselane 2025-2026)*

**Implication Clenzy.** Segment **moins prioritaire** pour une cible B2B2C conciergerie, mais c'est le **vivier de mandats** que captent les conciergeries clientes de Clenzy. Penser l'onboarding propriétaire *via* la conciergerie (portail propriétaire, reversements lisibles).

### 3.2 Gestionnaire pro / conciergerie (10-200 biens) — **cœur de cible Clenzy**

- **Critères primants** : **trust accounting / reversements propriétaires & relevés** (douleur n°1, sous-servie par les outils généralistes type QuickBooks/Xero), **app terrain mobile** (ménage/maintenance, auto-assignation depuis le PMS, check-lists, vérification photo), **automatisation des turnovers**, **multicanal robuste**, **pricing dynamique**, **portail propriétaire**, **conformité (facturation, taxe de séjour, déclarations)**.
- Les opérateurs « dépassent » les outils mono-entité et cherchent des systèmes pensés pour réservations + soldes propriétaires + payouts + reporting par bien.
- *(Probable — RNS/Escapia/CiiRUS/VRTrust 2025 ; Hostfully/Hostaway housekeeping 2025)*

**Implication Clenzy.** **Aligné avec les actifs Clenzy** : `ManagementContract` (taxonomie de paiement DIRECT / OWNER_COLLECTS / CONCIERGE_COLLECTS / OTA_COHOST_SPLIT), facture de commission NF, modules interventions/ménage, app terrain. **Le trust accounting / reversements + conformité FR est le fossé défendable n°1.**

### 3.3 Agence multi-pays / multi-orgs

- **Critères primants** : multi-devises, multi-langues, multi-fiscalités, gestion par entité/org, conformité différenciée par juridiction, API.
- *(Probable — rentalsunited/Guesty « global PMS » 2025)*

**Implication Clenzy.** Clenzy est déjà **multi-tenant + i18n (fr/en/ar) + RTL** : socle prêt pour l'**ambition Maroc/KSA non activée**. Mais la conformité étant *par juridiction*, l'expansion exige un investissement réglementaire dédié (non documenté pour MA/KSA dans cette note — **zone à instruire**).

---

## 4. Signaux réglementaires (FR / CH / UE)

> **Axe le plus critique pour Clenzy** : la conformité FR/UE est un fossé concurrentiel défendable face aux PMS US/globaux.

### 4.1 France — Loi Le Meur (n° 2024-1039 du 19 novembre 2024) **[STRUCTURANT]**

- **Texte** : LOI n° 2024-1039 du 19/11/2024 « visant à renforcer les outils de régulation des meublés de tourisme à l'échelle locale ». *(Confirmé — Légifrance, JORFTEXT000050612711)*
- **Enregistrement obligatoire** : toute mise en location d'un meublé de tourisme (y compris résidence principale) doit être **déclarée en mairie**, avec **numéro de déclaration** délivré immédiatement, **à afficher sur toutes les annonces**. *(Confirmé)*
- **Registre national** : prévu **au plus tard le 20 mai 2026**. *(Confirmé / Probable selon source — recoupé presse spécialisée)*
- **Plafond résidence principale** : **120 nuits/an** (90 à Paris). *(Probable)*
- **Fiscalité micro-BIC (revenus 2025, déclarés 2026)** :
  - Meublé **classé** : abattement **71 % → 50 %**, plafond **188 700 € → 77 700 €**.
  - Meublé **non classé** : abattement **50 % → 30 %**, seuil **77 700 € → 15 000 €**.
  - *(Probable — TGS France, jedeclaremonmeuble, decla.fr 2025 ; mécanisme confirmé par plusieurs sources, chiffres exacts à valider auprès d'un fiscaliste)*
- **DPE / performance énergétique (calendrier progressif)** : interdiction **G dès 01/01/2025**, **F au 01/01/2028**, **E au 01/01/2034** ; à compter du **01/01/2034**, DPE **A-D requis** pour maintenir l'activité. Nouvelles autorisations de changement d'usage : DPE **A-E** du 21/11/2024 au 31/12/2033, puis **A-D**. Amende jusqu'à **5 000 €**. Résidence principale exemptée. *(Probable — ADIL, BailFacile 2025)*

**Implication Clenzy.** **Opportunité majeure.** Clenzy peut faire de la conformité Le Meur un **différenciateur produit** : champ numéro d'enregistrement par bien + contrôle de présence sur annonces, suivi du compteur 120/90 nuits, alerte DPE, aide à la bascule micro-BIC/réel. Un PMS US ne couvrira pas ces spécificités. **Confiance : Confirmé (loi) / Probable (paramètres chiffrés).**

### 4.2 UE — Règlement (UE) 2024/1028 (partage de données STR) **[STRUCTURANT]**

- **Texte** : Règlement (UE) 2024/1028, adopté **11 avril 2024**. *(Confirmé — EUR-Lex)*
- **Date d'application : 20 mai 2026** — États membres et plateformes doivent disposer de systèmes d'enregistrement et de partage de données opérationnels. *(Confirmé — Commission européenne, communiqué « 2026-05-20 »)*
- **Obligations** : numéro d'enregistrement unique affiché sur toutes les annonces ; **point d'entrée numérique national unique** ; les plateformes (Airbnb, Booking…) **vérifient/affichent** les numéros et **transmettent des données d'activité standardisées au moins mensuellement** (identité hôte, adresse, n° d'enregistrement, nuits/séjours réservés) ; pouvoir des autorités d'ordonner le retrait d'annonces non conformes. **Ne fixe pas** de plafonds/zonages UE (laissés au local). *(Confirmé — EUR-Lex + Minut/Commission)*

**Implication Clenzy.** S'articule avec Le Meur : Clenzy doit **gérer le numéro d'enregistrement comme donnée de premier ordre** et anticiper les flux de reporting plateforme. Préparer dès 2025-T4 l'**alignement « registre + numéro affiché »** = être prêt avant le 20/05/2026. **Confiance : Confirmé.**

### 4.3 France — Facturation électronique obligatoire (Factur-X / PDP) **[STRUCTURANT]**

- **Calendrier (loi de finances 2024)** : **1ᵉʳ septembre 2026** — obligation de **réception** pour toutes les entreprises assujetties TVA + **émission** pour grandes entreprises et ETI ; **1ᵉʳ septembre 2027** — émission étendue aux **PME/TPE/micro**. *(Confirmé — recoupé Cegid, Kanta, MEG, BPI 2025-2026)*
- **Formats** : **Factur-X, UBL, CII** ; transit via **PDP** (Plateforme de Dématérialisation Partenaire immatriculée DGFiP) ou Chorus Pro (public). *(Confirmé)*
- **Point d'attention** : même les PME/micro doivent pouvoir **recevoir** dès **sept. 2026**.

**Implication Clenzy.** **Échéance produit dure.** Clenzy génère déjà des documents NF (cf. `document_generations`, factures de commission NF). Il faut **émettre/recevoir en Factur-X via une PDP** dès **sept. 2026** pour les clients ETI/GE et **sept. 2027** pour la masse PME. À mettre sur la roadmap **Next** comme jalon non négociable. **Confiance : Confirmé.**

### 4.4 France/UE — DAC7 (reporting fiscal des plateformes) *(complémentaire)*

- Depuis **janvier 2024**, Airbnb/Booking/Vrbo transmettent automatiquement les revenus des hôtes au **DGFiP** sous DAC7 ; reporting annuel au **31 janvier** (données N transmises au 31/01/N+1). *(Probable — your.rentals, expat-tax, KPMG 2023-2025)*

**Implication Clenzy.** Renforce le besoin de **cohérence des revenus déclarés** côté gestionnaire (rapprochement OTA ↔ compta Clenzy) : argument pour le module compta/reversements.

### 4.5 France — Taxe de séjour *(complémentaire)*

- Collecte automatique par les plateformes depuis **2019** ; depuis la réforme 2024, **latitude communale accrue** (écarts > 200 % entre communes), barème **1-5 %** du tarif nuitée (réel ou forfaitaire). Guide pratique officiel meublé de tourisme **édition 2025** (Ministère). *(Probable — economie.gouv.fr, ecologie.gouv.fr 2025)*

**Implication Clenzy.** Gérer une **table de taux de taxe de séjour par commune** + calcul automatique = feature de conformité locale différenciante (les plateformes la collectent, mais le gestionnaire doit la réconcilier en direct booking).

### 4.6 Suisse — régulation cantonale (Lex Airbnb) *(pour ambition future, pas FR)*

- **Pas de registre national** : tout est **cantonal/communal**. Genève : **plafond 90 nuits** en zone tendue ; Zurich : initiative populaire pour un plafond 90 nuits. **Taxe de séjour** standard (Genève **3,75 CHF/pers/nuit** < 40 j ; Zurich **3,50 CHF/pers/nuit** ≤ 30 nuits) souvent collectée par Airbnb. **Enregistrement des invités** auprès des autorités locales dans presque tous les cantons. Revenu imposable 22-46 %. *(Probable — Hostaway/UpperKey/PropertyOwner.ch 2025-2026)*

**Implication Clenzy.** **Non prioritaire** (CH hors cible activée), mais illustre que toute expansion = **conformité par juridiction**. À garder en réserve si extension DACH.

---

## 5. Menaces & opportunités macro

| # | Titre | Type | Impact | Horizon | Confiance |
|---|-------|------|--------|---------|-----------|
| M1 | **Désintermédiation par les OTA** (co-host Airbnb + partenariats Guesty) court-circuitant les PMS tiers | Menace | 3 | Next | À vérifier (signal) |
| M2 | **Banalisation de l'IA** : si tout PMS a des agents IA, Clenzy perd l'effet de nouveauté | Menace | 2 | Now | Probable |
| M3 | **Consolidation / guerre de capital** : Hostaway licorne, HomeToGo/Casago/Vacasa — pression prix & features sur un acteur FR sous-capitalisé | Menace | 2 | Next | Probable |
| M4 | **Contraction du parc STR FR** (loi Le Meur : 120 nuits, micro-BIC raboté, DPE) réduisant le TAM amateur | Menace | 2 | Next | Probable |
| O1 | **Conformité FR/UE comme fossé** (Le Meur + Règlement UE 2024/1028 + Factur-X + taxe de séjour) — non répliquable par PMS US | Opportunité | 3 | Now→Next | Confirmé |
| O2 | **Trust accounting / reversements propriétaires** sous-servi par les outils généralistes — cœur de douleur conciergerie | Opportunité | 3 | Now | Probable |
| O3 | **Direct booking comme levier de marge** (Booking Engine SDK Clenzy vs 1 Md$/an de commissions OTA sur repeat-guests) | Opportunité | 2 | Next | Probable |
| O4 | **App terrain / orchestration ménage** (turnover, auto-assignation, photo) — pénurie d'outillage intégré pour conciergeries | Opportunité | 2 | Next | Probable |
| O5 | **Formalisation co-host / OTA_COHOST_SPLIT** (mandats + commission NF) alignée sur la vague co-host Airbnb | Opportunité | 2 | Next | Probable |

---

## 6. Implications stratégiques pour Clenzy

1. **Faire de la conformité FR/UE le positionnement n°1** (O1). C'est le seul fossé qu'un PMS global ne franchit pas facilement. Roadmap : numéro d'enregistrement par bien + affichage annonces (Le Meur + Règl. UE 2024/1028, **échéance 20/05/2026**), Factur-X via PDP (**sept. 2026 / sept. 2027**), compteur 120/90 nuits, alerte DPE, taux taxe de séjour par commune. **Avant les concurrents, pas après.**
2. **Capitaliser sur le cœur conciergerie** (O2, O4, O5) : trust accounting / reversements propriétaires lisibles, portail propriétaire, app terrain, et formalisation du co-host (`ManagementContract` / commission NF déjà en place). C'est la cible où Clenzy a déjà des actifs.
3. **Positionner le Booking Engine comme outil de dé-commissionnement** (O3) : message « récupérez vos invités récurrents hors OTA », chiffré sur la douleur marché (12-20 % de commission, ~77 % du repeat-guest via OTA).
4. **IA spécialisée métier, pas générique** (M2) : orienter l'assistant LLM/RAG existant vers des cas FR à forte valeur (réponse réglementaire, génération de docs conformes, dispatch terrain) plutôt que la messagerie invité commoditisée.
5. **Veille active sur l'internalisation OTA** (M1) : surveiller ce qu'Airbnb/Booking absorbent (mise en relation, paiement, co-host). Défendre le périmètre que les OTA ne couvrent pas (compta multi-canal agnostique, conformité, terrain). **Thèse à confirmer par veille dédiée — actuellement signal, pas fait établi.**
6. **Ne pas courir la course features face aux licornes** (M3) : intégrer best-of-breed par API (pricing PriceLabs, apps ménage) plutôt que tout réinventer ; concentrer le capital R&D sur le fossé conformité + reversements.
7. **Garder l'ambition Maroc/KSA comme option, pas comme priorité** : socle multi-tenant/i18n/RTL prêt, mais conformité par juridiction = investissement dédié non instruit dans cette note (**zone à documenter avant activation**).

---

## 7. Sources (URL | date | confiance)

### Tendances secteur
- Hostaway 365 M$ / 925 M$ — https://techcrunch.com/2024/12/17/travel-is-back-hostaway-raises-365m-at-a-925m-valuation/ | déc. 2024 | Confirmé
- Hostaway funding (lead General Atlantic) — https://www.generalatlantic.com/media-article/hostaway-announces-365-million-strategic-growth-investment-led-by-general-atlantic/ | déc. 2024 | Confirmé
- Hostaway 1ᵉʳ PMS STR licorne (1 Md$) — https://app.dealroom.co/news/feed/hostaway-achieves-1b-valuation-milestone-1 | oct. 2025 | Confirmé
- HomeToGo acquiert Interhome (~200 M$, B2B pivot) — https://skift.com/2025/08/29/why-hometogo-bought-vacation-rental-operator-interhome-for-200-million/ | août 2025 | Confirmé
- HomeToGo–Interhome (date accord) — https://www.crunchbase.com/acquisition/hometogo-acquires-interhome-ag--445ae412 | janv. 2025 | Probable
- Consolidation marché (Casago/Vacasa, Hostaway/Tokeet) — https://www.openpr.com/news/4518924/vacation-rental-property-management-system-market-size | 2025 | Probable
- Consolidation (analyse) — https://www.hostaway.com/blog/consolidation-within-the-vacation-rental-industry/ | 2025 | Probable
- IA agents STR (Guesty AI) — https://www.guesty.com/features/ai-for-short-term-rentals/ | 2025-2026 | Probable
- IA / Lodgify pricing+messaging — https://www.lodgify.com/guides/ultimate-pms-guide/ | 2025 | Probable
- IA-natifs (Jurny/Enso/HostBuddy) — https://www.hostaway.com/blog/how-to-use-ai-in-your-short-term-rental-business/ | 2025 | Probable
- Direct booking vs OTA / 1 Md$ commissions repeat-guests — https://shorttermrentalz.com/news/ota-fees-repeat-guestys/ | 2025 | Probable
- Parts de canaux 2025 — https://www.rentalscaleup.com/airbnb-booking-com-and-vrbo-in-2025-what-property-managers-must-know/ | 2025 | À vérifier
- Co-host Airbnb (réseau, chiffres) — https://www.guesty.com/blog/airbnb-co-host-network-growth/ | 2025 | Probable
- Airbnb 8-K FY2025 (co-host) — https://www.sec.gov/Archives/edgar/data/0001559720/000119312525174438/d17531dex991.htm | 2025 | Confirmé
- Croissance marché STR (124,5→344 Md$) — https://www.wiseguyreports.com/reports/vacation-rental-property-management-software-market | 2024-2035 | À vérifier

### Attentes par segment / outillage
- Trust accounting (panorama éditeurs) — https://www.vrplatform.app/blog/what-is-trust-accounting-and-why-vacation-rental-managers-cant-ignore-it | 2025 | Probable
- Trust accounting (Hostaway) — https://www.hostaway.com/blog/trust-accounting/ | 2025 | Probable
- Housekeeping / app terrain (Breezeway, Turno, Properly, Doinn, TIDY) — https://www.hostaway.com/blog/best-vacation-rental-cleaner-management-tools/ | 2025 | Probable
- Coût manuel des turnovers / adoption tech — https://suiteop.com/blog/hidden-cost-manual-turnovers-vacation-rental-automation-2025 | 2025 | À vérifier
- Guide choix PMS (features/prix) — https://www.lodgify.com/guides/ultimate-pms-guide/ | 2025 | Probable
- PMS global multi-pays — https://rentalsunited.com/blog/the-top-global-vacation-rental-property-management-systems/ | 2025 | Probable

### Réglementaire FR
- Loi Le Meur (texte officiel) — https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050612711 | 19 nov. 2024 | Confirmé
- Loi Le Meur (synthèse, registre 20/05/2026, 120 nuits) — https://rendify.fr/guides/loi-le-meur-2026-enregistrement-meubles-tourisme | 2026 | Probable
- Numéro d'enregistrement / declaloc.fr — https://lvpdirect.fr/blog_proprietaires/numero-enregistrement-meubles-tourisme/ | 2025-2026 | Probable
- Micro-BIC classé 50 % / non classé 30 % — https://www.tgs-france.fr/blog/location-meublee-de-tourisme-non-classee-regles-fiscales-regime-micro-2025/ | 2025 | Probable
- LMNP 2025 (abattements/seuils) — https://www.jedeclaremonmeuble.com/lmnp-2025/ | 2025 | Probable
- DPE Le Meur (G 2025 / F 2028 / E 2034) — https://www.adil44.fr/liste-info-semaines/202519-loi-le-meur-la-performance-energetique-sinvite-dans-la-reglementation-des-meubles-de-tourisme/ | 2025 | Probable
- Facturation électronique 2026/2027 (Factur-X/PDP) — https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/ | 2025-2026 | Confirmé
- Facturation électronique (calendrier) — https://www.kanta.fr/articles/calendrier-de-facture-electronique-2026-2027-les-dates-cles-a-retenir | 2026 | Confirmé
- DAC7 hôtes (depuis janv. 2024, reporting 31 janv.) — https://your.rentals/blog/dac7-airbnb-hosts/ | 2024-2025 | Probable
- Taxe de séjour (collecte plateformes, latitude communale) — https://www.economie.gouv.fr/particuliers/voyager-et-se-deplacer/tourisme-comment-fonctionne-la-taxe-de-sejour | 2025 | Probable
- Guide pratique officiel meublé de tourisme 2025 (Ministère) — https://www.ecologie.gouv.fr/sites/default/files/documents/25113_GuidePratique2025MeubleTourisme.pdf | 2025 | Confirmé

### Réglementaire UE / CH
- Règlement (UE) 2024/1028 (texte) — https://eur-lex.europa.eu/eli/reg/2024/1028/oj/eng | 11 avr. 2024 | Confirmé
- Commission UE — application 20 mai 2026 — https://single-market-economy.ec.europa.eu/news/new-rules-bring-increased-transparency-short-term-rentals-sector-2026-05-20_en | mai 2026 | Confirmé
- Synthèse obligations (Minut) — https://www.minut.com/blog/eu-short-term-rental-regulations | 2026 | Probable
- Suisse (Genève/Zurich, taxe de séjour) — https://www.hostaway.com/blog/airbnb-rules-switzerland/ | 2026 | Probable
- Suisse (régulation cantonale) — https://www.propertyowner.ch/en/airbnb-under-pressure-how-swiss-cities-and-regions-regulate-short-term-rentals/ | 2025-2026 | Probable

> **Zones « non documentées » dans cette note** : (a) données réglementaires/fiscales Maroc & KSA (ambition non activée) — à instruire avant toute expansion ; (b) thèse explicite « OTA internalisent l'outillage PMS » — non confirmée par source spécialisée, statut signal ; (c) chiffres de marché (124,5→344 Md$, CAGR 7,6 %) issus de rapports payants à source unique.
