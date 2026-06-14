# T2 — Sociétés de service (conciergeries / property managers) : axe 2 du positionnement

> **Agent transverse T2** de la campagne d'analyse concurrentielle Clenzy.
> **Question centrale :** Clenzy est-il un **OUTIL** que les conciergeries achètent (B2B2C) ou un **SUBSTITUT** au service qu'elles vendent ?
> **Date :** 2026-06-13 — **Périmètre géo :** France (ancrage prod), avec comparables internationaux.
> **Méthode :** recherche web datée + sourcée 2024-2026, niveaux de confiance, « non documenté » si introuvable. Pas d'extrapolation.

---

## 1. Périmètre & méthode

**Nature des acteurs.** L'axe 2 ne compare PAS Clenzy à des éditeurs de logiciel (c'est l'axe 1, lots B1-B10) mais à des **sociétés de service** : les conciergeries et property managers qui vendent au propriétaire une **prestation opérée** (annonce, ménage, accueil, maintenance, pricing) contre une **commission sur les revenus locatifs**, et non une licence logicielle.

**Pourquoi c'est un axe distinct.** Le cadrage interne (`00-cadrage.md` §2) établit que la cible primaire de Clenzy = conciergeries / gestionnaires pro (modèle **B2B2C**), preuve code : `OrganizationType.CONCIERGE`, `ManagementContract`, `OwnerPayout`, module `owner-portal/`, rôles terrain (`HOUSEKEEPER/TECHNICIAN/...`). La question stratégique est donc : ces sociétés sont-elles des **clients** (elles s'outillent avec Clenzy) ou des **concurrents** (Clenzy vend le même service au propriétaire) ?

**Panel retenu.**
- **Internationaux :** GuestReady, Houst, Pass the Keys.
- **France / francophone :** Cocoonr, Welkeys, BnbLord (+ BnbLord Prestige), et contexte marché (réseau CLF — Conciergeries Locatives de France).
- *Wello* : **non documenté** de manière fiable par recherche web (homonymes multiples : néobanque, santé). Aucune fiche conciergerie STR exploitable trouvée → écarté pour ne pas inventer.

**Limites.** Les conciergeries publient rarement leurs grilles exactes (tarif « sur devis selon ville/profil »). Les pourcentages ci-dessous sont datés et sourcés mais restent des **fourchettes annoncées** ; les seuils précis sont souvent négociés. Le détail « outillé vs manuel » par acteur est partiellement déductif (peu d'acteurs documentent leur stack interne) — signalé en confiance `Probable`.

---

## 2. Panel & modèles économiques (commission, services)

### 2.1 Standard de marché (France, 2026)

- **Commission :** **15 % à 30 %** des revenus locatifs ; fourchette dominante **20-25 %** ; zones tendues (Paris, Côte d'Azur) jusqu'à **25-40 %**. *(Confiance : Confirmé — convergence de multiples sources FR datées 2026 : welkeys.com/blog, finance-heros.fr, lmnp.ai, toploc.com.)*
- **Alternative forfait fixe :** **100 € à 800 €/mois** selon prestations (modèle minoritaire vs commission). *(Confiance : Confirmé.)*
- **Modèle dominant observé :** ~20 % des revenus + **ménage refacturé au voyageur** (sorti du périmètre commission). *(Confiance : Probable.)*
- **TVA :** commission soumise à **TVA 20 %** (taux normal) ; obligatoire au-delà du seuil de franchise (~34,4 k€ HT cité). *(Confiance : Confirmé — bensaid-avocats.fr, secteur-usinier.com.)*

### 2.2 Fiches acteurs

| Société | Pays / marché | Commission (daté, sourcé) | Services inclus | Confiance |
|---|---|---|---|---|
| **GuestReady** | UK, FR, PT, UAE, MY, HK, KSA | « à partir de 12-15 % » des revenus, **variable selon ville/profil** ; **frais d'onboarding one-shot** (photo + création annonce + visite, déduit du 1er mois) ; **option loyer fixe** sur certains marchés ; **maintenance en sus**. | Onboarding (inspection, photo pro, dashboard), gestion d'annonce multi-plateforme, pricing dynamique, paiements, accueil 24/7, ménage « 5 étoiles », linge/toiletteries, vérification voyageur + assurance. | Confirmé (guestready.com/pricing, 2026) |
| **Houst** | UK (+ international, AU) | **Flexible** : 20 % (Londres 18 %) + **24,99 £/mois** ; **Professional** (selon durée d'engagement) : 18 %/16 %/14 % (12/24/36 mois) — Londres 15 %/14 %/12 % — + **19,99-24,99 £/mois** ; remise multi-biens. | Support hôte, **Smart Pricing Optimizer**, accueil 24/7, support maintenance, ménage + blanchisserie, **cleaning reports**, account manager dédié, service longue durée. | Confirmé (houst.com/pricing, 2026) |
| **Pass the Keys** | UK (**modèle franchise**) | **15-20 %** du revenu (TVA incluse), **fixé par chaque franchisé** → varie par localisation. | Photo pro, mise en ligne multi-plateforme, screening + comm voyageurs, pricing dynamique, remise de clés / serrure connectée, ménage hôtelier + linge, coordination maintenance, support 24/7. | Confirmé (passthekeys.com, ibtimes.co.uk 2025/26) |
| **Cocoonr** | France (ex-Book&Pay) | Commission sur revenus, **généralement plus basse** que les conciergeries traditionnelles (services partiellement sous-traités à un **réseau de partenaires locaux**). % exact **non publié**. | Gestion complète : maintenance, coordination réservations, ménage inter-séjours, linge de qualité, préparation du bien. | Probable (cocoonr.fr/magazine, lebureaudelimmo.fr) |
| **Welkeys** | France (premium) | « à partir de **20 % TTC** » ; fourchette annoncée **18-25 %** selon ville/services ; **taux dégressif** selon nombre de biens ; **sans engagement**, « sans frais cachés ». | Création/optimisation annonce, multicanal (Airbnb/Booking/site proprio), accueil, ménage, blanchisserie, maintenance, assurances, gestion administrative, pricing dynamique, assistance 24/7. | Confirmé (welkeys.com 2026) |
| **BnbLord** | France (Paris+) | **18-22 %** des revenus ; **BnbLord Prestige** (biens d'exception, ~80 propriétaires) **20-25 %** + services sur-mesure. | Création annonce, comm voyageurs, ménage, optimisation tarifaire, assistance 24/7 ; Prestige : conciergerie voyageurs luxe, séjours sur-mesure. | Probable (bnblord.com, eldorado-immobilier.com) |

### 2.3 Lecture économique

- La commission **15-30 %** est l'**unité de valeur** de ces sociétés : elle paie principalement de la **main-d'œuvre** (accueil, ménage, support) et de la **prise de risque commerciale**, pas une licence logicielle.
- Le coût d'un **PMS SaaS** (Clenzy ≈ 30 €/org + 10 €/siège, cf. cadrage §6) est, pour une conciergerie, un **coût d'exploitation marginal** (quelques % d'un siège) face à 15-30 % de top-line. → **Le PMS n'est pas en concurrence de prix avec la commission** ; il en est un **intrant**.

---

## 3. Outillé vs manuel (matrice)

> Question : parmi les fonctions du métier, lesquelles ces sociétés **automatisent par logiciel** vs **opèrent à la main / sous-traitent** ? Constat issu des pages produit + littérature secteur (lodgify, hostnlib, albconciergerie, jana-concierge). Confiance globale : `Probable` (peu d'acteurs documentent leur back-office).

| Fonction | Tendance marché | Détail |
|---|---|---|
| **Channel management (anti-double-résa)** | **Outillé** (quasi-universel) | Channel manager / PMS = brique n°1 citée comme indispensable. Beds24, Smoobu, Lodgify, Guesty, Hostaway plébiscités. Les pros qui restent sur **Excel** sont pointés comme un anti-pattern (« Excel est votre ennemi en 2026 »). |
| **Messagerie voyageurs** | **Outillé + humain** | Automatisation des messages pré/pendant/post-séjour via PMS, mais escalade humaine 24/7 (cœur de la valeur facturée). |
| **Pricing dynamique** | **Outillé** | PriceLabs / Beyond / optimiseurs maison (Houst « Smart Pricing »). Réglages encore souvent supervisés à la main. |
| **Planning ménage / interventions** | **Mixte → souvent manuel** | Beaucoup de petites conciergeries coordonnent ménage/linge par **WhatsApp + tableur + agenda**. Les PMS pro (Hostaway, RentalReady, Turno) outillent le scheduling, mais l'adoption est partielle chez les < 50 lots. **C'est le maillon le moins outillé du segment.** |
| **Reversements propriétaires (owner payout)** | **Manuel / semi-manuel — point de douleur majeur** | Plainte n°1 des propriétaires : **opacité du relevé** (« virement reçu mais pas d'explication du calcul »). Beaucoup de relevés = « revenus − commission » sans détail par canal/séjour/taxe. Recommandation explicite du secteur : pour ≥ 3 biens, un PMS qui **calcule automatiquement**. *(Confiance : Confirmé — rentaplus.immo 2026.)* |
| **Reporting propriétaire** | **Mixte** | Owner portals temps réel chez les gros PMS (Guesty, Hostaway « 90 % de temps gagné au closing mensuel ») ; **PDF/Excel manuel** chez les petits. |
| **Facturation commission (compta/TVA/NF)** | **Manuel / sous-traité comptable** | Facture de commission B2B (TVA 20 %), DAS2, archivage. **Facture électronique B2B obligatoire** (échéance PME ~2027, e-reporting). Aujourd'hui largement géré hors PMS (comptable, modèle de facture Word/Lodgify). *(Confiance : Confirmé — livretaccueil.com, lmnp.ai 2026.)* |
| **App terrain (équipes ménage/maintenance)** | **Souvent manuel** | Coordination terrain par messagerie ; les app mobiles dédiées (check-list, photos avant/après) sont un différenciateur des PMS pro, peu répandu chez les petits. |

**Synthèse §3 :** le **front-office** (channel, messagerie, pricing) est largement outillé ; le **back-office gestionnaire** (planning terrain, **reversements multi-propriétaires**, **reporting propriétaire structuré**, **facturation NF/TVA**) reste **le ventre mou**, opéré à la main ou sous-traité — **exactement le périmètre où Clenzy est fort** (cadrage §7 : Finance/Compta **3**, Opérations **3**, Mobile **3**).

---

## 4. Clenzy : outil B2B2C ou substitut ?

### 4.1 Verdict : **OUTIL B2B2C** (l'OS de la conciergerie), pas substitut.

**Arguments pour « outil ».**
1. **Clenzy ne touche pas le cash voyageur sur OTA** (note mémoire `project_ota_payment_invoicing` : OTA = déjà payé sur le canal, affiché « Payé », pas de wallet escrow). Il ne capte donc pas la marge de service de la conciergerie — il l'**outille**.
2. **L'architecture est multi-tenant orientée gestionnaire** : `ManagementContract` (mandat propriété↔propriétaire), `OwnerPayout` (reversements), `portfolios/`, `owner-portal/`, rôles terrain. Ce sont les objets métier d'une **conciergerie**, pas d'un propriétaire isolé.
3. **Économie alignée :** SaaS par siège ≈ coût marginal vs commission 15-30 %. Clenzy **augmente la marge** de la conciergerie (moins de main-d'œuvre back-office) au lieu de la concurrencer.

**Le risque de cannibalisation existe mais est maîtrisable.**
- **Précédent fort : GuestReady → RentalReady.** GuestReady (conciergerie, 4 000+ biens, 2016) a construit son PMS interne **RentalReady** puis l'a **licencié à des tiers depuis 2019** (Wikipedia GuestReady, guestready.com/property-management-software). C'est la preuve vivante que **le service et le logiciel sont deux business distincts et compatibles** — mais aussi que Clenzy aura un concurrent éditeur **issu d'une conciergerie**, qui « parle le métier ».
- **Risque inverse pour Clenzy :** si Clenzy se met à opérer du service (prendre des mandats, encaisser des commissions), il devient le **concurrent** de ses propres clients → destruction de la proposition B2B2C. **Recommandation : Clenzy reste éditeur, ne prend jamais de mandat en propre.** (Aligné note `feedback_no_manual_prod_fixes` sur la discipline produit.)

### 4.2 Fonctionnalités-clés qui font de Clenzy un « OS de conciergerie » (preuve code, cadrage §7)

1. **Reversements multi-propriétaires automatisés** — `OwnerPayout` (PENDING→APPROVED→PAID) + 4 rails payout (Stripe Connect / Wise / Open Banking PIS / SEPA XML). **Répond directement à la douleur n°1 du marché** (opacité des relevés).
2. **Contrats de mandat + facture de commission NF** — `ManagementContract` (4 types, 4 PaymentModel) + `CommissionInvoiceService` (`InvoiceType.COMMISSION`) + numérotation NF + signature électronique du mandat (`/sign/{token}`). **Répond à l'obligation facture électronique B2B 2026-2027.**
3. **App terrain mobile** — 85 écrans RN, offline (MMKV), photos avant/après ménage, signature. **Outille le maillon le moins automatisé du segment** (planning + exécution ménage/maintenance).
4. **Reporting propriétaire** — `owner-portal/`, dashboards, exports PDF/CSV/FEC. Transforme le relevé Excel opaque en **portail temps réel**.
5. **Conformité fiscale FR (NF + FEC + TVA)** — bunker Finance/Compta (score interne 3). Décharge la conciergerie de la sous-traitance comptable partielle.

---

## 5. Fonctionnalités manquantes pour servir les conciergeries

> Ce que Clenzy doit (ou devrait) offrir pour être adopté **comme l'OS** d'une conciergerie. Croisé avec les réserves du cadrage §7-8.

| Manque | Pourquoi ça bloque l'adoption conciergerie | Statut Clenzy (cadrage) |
|---|---|---|
| **Réponses IA aux voyageurs** | La messagerie 24/7 est le volume de travail n°1 ; sans suggestion/réponse IA, Clenzy n'allège pas le coût de main-d'œuvre principal. | Absent (cadrage §8 : « Réponses IA = Faux ») |
| **Onboarding propriétaire packagé** | Les conciergeries vendent un onboarding (photo, inspection, mise en ligne). Pas de workflow d'onboarding propriétaire/bien outillé. | Non documenté côté produit |
| **Refacturation flexible du ménage au voyageur** | Modèle dominant = « commission + ménage refacturé au voyageur ». Doit être natif (frais ménage → ligne séjour → relevé). | À vérifier (fee engine) |
| **Forecast CA / disponibilité** | Argument de vente conciergerie = « +25 % de revenus ». Sans forecast, pas de pilotage de promesse. | Absent (cadrage §8) |
| **Grille de commission dégressive par portefeuille** | Welkeys/Houst pratiquent le dégressif multi-biens ; le `ManagementContract` doit modéliser des barèmes dégressifs/par paliers. | À vérifier (CommissionBase existe ; dégressif ?) |
| **SMS** | Canal d'accueil encore utilisé ; SMS retiré (WhatsApp only). | Absent (cadrage §8) |
| **Déclaration voyageurs (fiche police) / taxe de séjour** | Obligation FR ; douleur opérationnelle citée. | Absent (cadrage §12) |

---

## 6. Recommandations go-to-market & initiatives

### 6.1 Positionnement (message)

- **Slogan d'axe :** « **Clenzy ne prend pas votre commission, il la protège.** L'OS de votre conciergerie : reversements, mandats, terrain, NF — en automatique. »
- **Ne jamais se présenter comme une conciergerie.** Clenzy = **éditeur neutre**. Argument anti-RentalReady : « un logiciel d'éditeur, pas d'un concurrent qui gère aussi des biens en face de vous ».
- **Cibler la douleur prouvée :** le relevé propriétaire opaque + l'obligation facture électronique 2026-2027. Ce sont deux **deadlines réglementaires/relationnelles** qui créent l'urgence d'achat.

### 6.2 Marché adressable (datés, sourcés)

- **~5 000 conciergeries** recensées en France (réseau CLF, 2024) ; **~30 %** des logements Airbnb gérés par une conciergerie (2025) ; marché conciergerie **~150 M€ CA** (2025), croissance **+4,5-15 %/an**. *(Confiance : Probable — hostnlib.com, conciergebb.fr 2025. Chiffres d'agrégateurs, à recouper avec l'agent T1 marché.)*
- → TAM B2B2C français **non négligeable** : même 10 % des 5 000 conciergeries à ~30-50 €/siège × N sièges = base SaaS récurrente significative.

### 6.3 Initiatives priorisées

| Titre | Type | Impact (1-3) | Effort (S/M/L) | Reach (1-3) | Confiance |
|---|---|:--:|:--:|:--:|:--:|
| Portail propriétaire « relevé transparent » (CA brut → frais détaillés → net reversé, par canal/séjour) comme argument anti-douleur n°1 | Produit + GTM | 3 | M | 3 | 0.8 |
| Kit conformité « facture électronique B2B 2026-2027 » (facture commission NF + e-reporting) packagé pour conciergeries | GTM (réglementaire) | 3 | M | 3 | 0.75 |
| Programme partenaire conciergerie (tarif dégressif multi-org, onboarding white-glove, pas de prise de mandat en propre) | GTM / pricing | 2 | S | 3 | 0.7 |
| Réponses IA voyageurs (combler le manque qui empêche de réduire le coût main-d'œuvre n°1) | Produit | 3 | L | 2 | 0.7 |
| Grille de commission dégressive par paliers dans `ManagementContract` (aligner sur Welkeys/Houst) | Produit | 2 | S | 2 | 0.65 |

---

## 7. Sources (URL | date | confiance)

| # | Source (URL) | Date consultée | Confiance / portée |
|---|---|---|---|
| 1 | https://www.guestready.com/pricing/ | 2026-06-13 | Confirmé — commission variable, onboarding fee, loyer fixe, services |
| 2 | https://en.wikipedia.org/wiki/GuestReady | 2026-06-13 | Confirmé — 4 000+ biens (2019), RentalReady licencié dès 2019, géo |
| 3 | https://www.guestready.com/property-management-software/ | 2026-06-13 | Confirmé — RentalReady = PMS vendu à des tiers (channel, ménage, owner statements, IA, pricing par nb de biens) |
| 4 | https://www.houst.com/pricing | 2026-06-13 | Confirmé — grilles 12-20 % + frais mensuel £, Smart Pricing |
| 5 | https://www.passthekeys.com/en/services-pricing/ + ibtimes.co.uk (Top 8 London 2025/2026) | 2026-06-13 | Confirmé — 15-20 %, modèle franchise |
| 6 | https://www.welkeys.com/blog/tarif-conciergerie-airbnb | 2026-06-13 | Confirmé — 20 % TTC mini, 18-25 %, dégressif, sans engagement |
| 7 | https://www.welkeys.com/blog/conciergerie-airbnb-chiffres-cles-france | 2026-06-13 | Probable — chiffres marché FR |
| 8 | https://www.bnblord.com/city/paris/ + eldorado-immobilier.com/tarifs-de-conciergerie/ | 2026-06-13 | Probable — 18-22 % (Prestige 20-25 %) |
| 9 | https://cocoonr.fr/magazine/... + lebureaudelimmo.fr/cocoonr-avis/ | 2026-06-13 | Probable — commission plus basse, réseau partenaires |
| 10 | https://www.rentaplus.immo/blog/2026-06-05-releve-conciergerie-airbnb-revenu-net-proprietaire/ | 2026-06-13 | Confirmé — douleur n°1 = relevé opaque ; PMS calcule auto |
| 11 | https://albconciergerie.fr/logiciel-conciergerie-channel-manager-excel-pms/ | 2026-06-13 | Probable — anti-pattern Excel, brique channel manager |
| 12 | https://www.lodgify.com/blog/fr/outils-conciergerie-airbnb/ + hostnlib.com (outils + marché FR) | 2026-06-13 | Probable — stack outils conciergerie, chiffres marché |
| 13 | https://hello.pricelabs.co/fr/blog/faut-il-une-carte-g-pour-exercer-en-conciergerie-airbnb...2025/ | 2026-06-13 | Confirmé — carte G / loi Hoguet, structure mandat |
| 14 | https://livretaccueil.com/facturation-electronique-location-courte-duree + lmnp.ai | 2026-06-13 | Confirmé — facture électronique B2B obligatoire 2026-2027 |
| 15 | https://www.bensaid-avocats.fr/airbnb-tva/ + secteur-usinier.com | 2026-06-13 | Confirmé — TVA 20 % commission, seuils, DAS2 |
| 16 | https://www.hostaway.com/blog/guesty-vs-hospitable-vs-hostaway... + guesty.com/blog | 2026-06-13 | Confirmé — owner statements auto, scheduling ménage, IA concierge (benchmark des fonctions outillées) |

> **Réserve « Wello » :** aucune fiche conciergerie STR fiable trouvée (homonymie néobanque/santé). Marqué **non documenté**, écarté du panel pour ne pas inventer.
> **Chiffres marché FR** (5 000 conciergeries, 150 M€, 30 % du parc) : agrégateurs sectoriels, confiance `Probable` — à recouper avec l'agent **T1** (marché/réglementation).
