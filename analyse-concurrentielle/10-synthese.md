# Phase 2 — Synthèse & positionnement

> ⚠️ **Amendement 2026-07-12 — deux vagues de re-notation (le positionnement a bougé).** Le benchmark initial de ce document (V1, 13/06) donnait **1.86**. Deux vagues de livraisons l'ont fait progresser — suivi complet dans `data/60-evolution-scores.csv` + matrice colorée `pdf/matrice-scores-v1-v2-v3.pdf` :
> - **V2 (27/06) → 2.20** : Booking engine re-noté 1.4→2.7 (SSR/SEO + Studio GrapesJS + génération site IA…), Finance 2.2→2.5, Channel 2.0→2.5, Communication 1.6→2.1, vague conformité/IA. La colonne « Baitly » de la heatmap §1 reflète désormais l'état à jour (V3).
> - **V3 (12/07) → 2.31** : **Moteur Ménage** livré → **D5 2.2→2.8** (prix conseil calculé + tarifs housekeeper cadrés + paiement gaté preuve photo + anomalies→maintenance ; benchmark juillet : **aucun PMS ne calcule un prix conseil ménage** — nouveau moat §3bis). **Constellation multi-agents DÉPLOYÉE + autonomie déterministe opt-in** → **D13 1.6→2.4** (le « potentiel IA verrouillé » §2.2 est débloqué). Versements prestataires → **D8 2.5→2.6**. Agent Communication → **D6 2.1→2.2**. Modal unifié réservation/blocage → **D3**.
> - **Caution/dépôt** (faiblesse « seul acteur à 0 » §4) : exécuteurs de libération de caution livrés → faiblesse **obsolète**.
> - **Score global : 1.86 → 2.20 → 2.31** → Baitly passe **6ᵉ → 3ᵉ**, désormais **à égalité avec Hostaway (2.31)**, derrière Guesty (2.52). Scores concurrents = benchmark juin (à re-benchmarker).

> ⚠️ **Amendement 2026-06-14 :** le positionnement « ancrage France » de ce document est **étendu à un cap multi-pays FR + Maroc + Arabie Saoudite** (décision utilisateur). Le fossé de conformité devient multi-juridiction. Plan technique : [42-objectifs-techniques.md](42-objectifs-techniques.md) · [41-strategie-multipays.md](41-strategie-multipays.md) · [data/40-feature-evolution.csv](data/40-feature-evolution.csv).

> **Produit :** Baitly (PMS SaaS multi-tenant STR). **Date :** 2026-06-13.
> **Base de scoring :** moyennes **par fonctionnalité** (grille 0–3) calculées par chaque sous-agent depuis les CSV `data/`, panel de 7 PMS comparables. Les scores « domaine holistique » du cadrage (§7) restent cités quand ils divergent.
> **Réserve méthodo :** les scores du domaine 7 pour Smoobu/Lodgify/Hospitable/Avantio/Smily sont **estimés** (le benchmark livret a comparé Baitly aux spécialistes Touch Stay/Duve/Chekin/Enso/Hostfully + Hostaway/Guesty). Confiance globale concurrents : *Probable* (détails fins à vérifier au cas par cas).

---

## 1. Matrice de comparaison globale (heatmap des scores)

Échelle : 0 Absent · 1 Basique · 2 Standard marché · 3 Avancé/différenciant.

| # | Domaine | Poids | **Baitly** | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|---|---------|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| 1 | Channel Management | 11 | 2.5 | 3.0 | 3.0 | 2.1 | 2.5 | 2.3 | 2.9 | 2.9 |
| 2 | Booking engine & direct | 6 | **2.7** | 2.3 | 2.5 | 1.4 | 2.2 | 1.9 | 2.1 | 2.1 |
| 3 | Calendrier & multi-tenant | 8 | **2.7** | 2.8 | 2.8 | 2.1 | 2.1 | 2.2 | 2.6 | 2.7 |
| 4 | Tarification / Yield | 9 | 1.9 | 2.7 | 2.7 | 1.6 | 2.2 | 2.4 | 2.2 | 1.5 |
| 5 | Opérations ménage/maint. | 9 | **2.8** | 1.9 | 2.3 | 0.8 | 1.3 | 1.8 | 1.8 | 1.4 |
| 6 | Communication voyageurs | 11 | 2.2 | 2.7 | 2.6 | 1.2 | 1.9 | 2.4 | 2.1 | 2.2 |
| 7 | Guest Experience & Livret | 7 | 1.9 | 1.9 | 2.3 | 1.0* | 1.3* | 1.5* | 1.5* | 1.3* |
| 8 | Finance & Compta | 11 | **2.6** | 1.8 | 2.2 | 1.0 | 1.5 | 1.2 | 1.7 | 1.6 |
| 9 | Reporting & Analytics | 7 | 2.0 | 2.3 | 2.6 | 1.1 | 2.1 | 2.1 | 2.0 | 1.8 |
| 10 | Intégrations & API / IoT | 6 | 1.5 | 2.4 | 2.6 | 1.5 | 1.7 | 2.1 | 1.8 | 1.8 |
| 11 | Application mobile | 5 | **2.5** | 1.8 | 1.9 | 1.3 | 1.7 | 1.5 | 1.3 | 1.7 |
| 12 | Admin, sécurité & conf. | 5 | 2.0 | 1.8 | 2.3 | 1.3 | 1.7 | 1.4 | 1.7 | 1.6 |
| 13 | IA & automatisation | 5 | 2.4 | 1.8 | 2.6 | 0.3 | 0.8 | 1.6 | 0.6 | 1.2 |
| — | **SCORE GLOBAL PONDÉRÉ** | 100 | **2.31** | **2.31** | **2.52** | 1.32 | 1.81 | 1.92 | 1.96 | 1.89 |

\* domaine 7 estimé pour ces 5 PMS (voir réserve méthodo). **Gras Baitly** = domaines où Baitly est n°1 ou co-leader. **Colonne Baitly = V3 (12/07)** ; évolution V1→V2→V3 par domaine dans `data/60-evolution-scores.csv` et la matrice colorée `pdf/matrice-scores-v1-v2-v3.pdf`. Scores concurrents = benchmark juin (à re-benchmarker au prochain cycle).

---

## 2. Classement global (score pondéré sur 3)

1. **Guesty — 2.52** (leader breadth, enterprise)
2. **Hostaway — 2.31** (leader breadth, agences)
3. **Baitly — 2.31** ↑ *(V1 1.86 → V2 2.20 → V3 2.31 ; à égalité avec Hostaway)*
4. Avantio — 1.96
5. Hospitable — 1.92
6. Smily — 1.89
7. Lodgify — 1.81
8. Smoobu — 1.32

**Lecture :** après les deux vagues de livraisons (juin V2, juillet V3), Baitly passe du **milieu de peloton (6ᵉ) au 3ᵉ rang à 2.31**, **rattrapant Hostaway** (2.31) et ne laissant devant que Guesty (2.52). Il se détache nettement du groupe Avantio/Hospitable/Smily (1.89–1.96). Le mouvement vient surtout de deux domaines : **IA/automatisation** (potentiel enfin activé) et **Opérations ménage** (nouveau différenciateur). **Mais la moyenne masque toujours l'essentiel** : le profil de Baitly reste **« pointu », pas plat** — et il a désormais **deux pics de différenciation** (conformité FR + économie du ménage), pas un seul.

### 2.1 Profil spiky — là où Baitly gagne / perd

| Position | Domaines | Score | Commentaire |
|----------|----------|-------|-------------|
| 🥇 **N°1 du panel (V3)** | **Opérations ménage (2.8)**, **Finance & Compta (2.6)**, **Booking engine (2.7)**, **Mobile (2.5)** | > leaders | Moteur Ménage unique, conformité, direct booking, terrain natif |
| 🥈 **Co-leader** | Calendrier/multi-tenant (2.7) | ≈ Guesty/Hostaway (2.8) | Anti-overbooking transactionnel, multi-tenant fail-closed |
| 🟢 **Rattrapé (V1→V3)** | IA (1.2→2.4), Communication (1.6→2.2), Admin/sécurité (1.6→2.0), Reporting (1.7→2.0) | ≈ marché | Le « potentiel verrouillé » activé (constellation, copilote, 2FA, report builder) |
| 🔴 **Retard restant** | Intégrations/IoT (1.5), Tarification/Yield (1.9), Guest Experience (1.9) | < marché | Zapier/Make absents, IA pricing verrouillée, breadth livret |

### 2.2 Le « retard » est en grande partie du potentiel verrouillé

Plusieurs faiblesses **ne sont pas des absences mais des fonctions implémentées et coupées par feature-flag** :
- IA de **tarification** (`pricing-ai=false`), IA de **messagerie/suggestion de réponse** (`messaging-ai=false`, pas d'autopilot), **multi-agent** (off), **insight IA reporting** (`analytics-ai=false`).
- **Yousign + DocuSeal** = vrais services, désactivés.
- **Forecast** d'occupation existe (basique), non mis en avant ; **comparaison N/N-1** : donnée présente, non affichée.

> **Scénario « activation » — RÉALISÉ (2026-07).** La prédiction de juin (« allumer les flags IA ferait passer 1.86 → ~2.0 ») s'est concrétisée : la **constellation multi-agents est déployée** et dotée d'une **autonomie déterministe opt-in** (le système apprend à automatiser ce que l'humain valide régulièrement, via des « Règles de Confiance »), et le **Moteur Ménage** a créé un différenciateur nouveau. Score pondéré **2.31** (V3), à égalité avec Hostaway. La bataille reste la même : **différenciation pointue** (désormais 2 moats) **+ déverrouillage continu** (reste : SMS/autopilot messagerie, N/N-1 reporting, Zapier/Make, statut partenaire OTA).

---

## 3. Positionnement double axe

### Axe 1 — vs PMS (éditeurs de logiciel)
- **Compétitif comme logiciel ? Oui, sur un créneau, pas en généraliste.** Baitly n'a pas la breadth de Guesty/Hostaway (channel, IA, intégrations, marketplace) ni leur statut de partenariat OTA (Preferred+/Premier).
- **Mais il domine 3 domaines à forte valeur pour une conciergerie FR** : Finance/Compta (NF + FEC + trust accounting câblé + 4 rails payout + Pennylane), Opérations terrain (pipeline check-out→ménage + routing géo + app mobile native 85 écrans), Calendrier/multi-tenant.
- **Fossé défendable = conformité française** (NF inviolable, FEC, facture de commission NF, taxe de séjour) que **personne** dans le panel n'adresse — Guesty/Hostaway sont US/global et ne couvrent pas la norme FR.

### Axe 2 — vs sociétés de service (conciergeries)
- **Verdict : Baitly est un OUTIL B2B2C (l'« OS de la conciergerie »), PAS un substitut.** Son économie (abonnement par siège, marginal) *augmente* la marge du gestionnaire au lieu de capter sa commission (15–30 % du CA locatif).
- Les conciergeries outillent leur **front-office** (channel, messagerie, pricing) mais opèrent leur **back-office au manuel/Excel** : reversements propriétaires, relevé propriétaire, facturation NF, planning ménage terrain — **exactement le terrain fort de Baitly**.
- **Précédent :** GuestReady a bâti son propre PMS (RentalReady) et le licencie → service et logiciel sont des business compatibles. **Garde-fou :** Baitly ne doit **jamais prendre de mandat en propre** (cannibaliserait ses clients).
- **Opportunité GTM :** adresser les conciergeries comme clients (programme partenaire, tarif multi-org, kit conformité facture électronique B2B 2026–2027).

---

## 3bis. Le Moteur Ménage — un 2ᵉ fossé défendable (nouveau, 2026-07)

> Le positionnement de juin reposait sur **un** moat : la conformité fiscale FR. Depuis, un **second moat** est apparu, sur le domaine 5 (Opérations) — et il est peut-être plus universel (il ne dépend pas de la juridiction).

**Le constat marché (benchmark juillet 2026, 10 PMS + 7 spécialistes ménage) :** dans TOUT le marché PMS, le prix d'un ménage est soit un **champ libre** (Hostaway, Guesty), soit un **forfait configuré** (Superhote, Amenitiz), soit **externalisé à un marketplace d'enchères** (Turno, Cleanster). **Aucun PMS ne calcule un prix de ménage conseillé**, et la chaîne complète « prix conseillé → tarif propre par prestataire cadré → paiement à la complétion **gaté par preuve photo** → anomalie monétisée » **n'existe nulle part en natif.**

**Ce que Baitly a livré (unique sur le marché) — la chaîne en 5 étapes :**

<!--DIAG-MENAGE-->

Un **seul calcul** produit la durée ET le prix (décomposable ligne à ligne = transparence, donc acceptation par les prestataires). Le prestataire n'est **payé qu'une fois la preuve photo validée** ; et une anomalie constatée sur le terrain devient automatiquement un **devis de maintenance chiffré** — le maillon que même Turno n'a pas comblé.

**Positionnement concurrentiel précis :** le concurrent FR le plus proche est **Superhote** (tarif par prestataire + dû auto-calculé) mais **sans prix conseillé, sans payout intégré, sans gate photo**. **Hospitable** a le payout à la complétion mais **uniquement via un marketplace tiers US (Cleanster)**, sans contrôle du gestionnaire sur ses propres cleaners. → Baitly est **le seul PMS avec la chaîne complète en natif, pour l'équipe du gestionnaire.**

**Pourquoi c'est un moat :** capitalise sur un socle d'exécution déjà au niveau des spécialistes (routing géo natif, app terrain offline, pipeline check-out→ménage) que les leaders PMS **délèguent** à Turno/Breezeway. Baitly avait déjà l'exécution ; il ne manquait que l'étage économique — désormais livré. C'est difficile à répliquer pour un PMS généraliste sans refondre ses opérations.

> **Note (Turno, Breezeway) :** ce sont des **spécialistes du ménage cités en référence**, pas des concurrents qu'on affronte. Le fait que même les meilleurs outils dédiés ne couvrent pas notre chaîne complète prouve que le fossé tient **partout** — y compris au Maroc et en Arabie Saoudite, où ces acteurs sont absents.

## 4. SWOT consolidée

### Forces (preuves code)
- **Conformité fiscale FR de bunker** : facturation NF inviolable + numérotation séquentielle + export FEC + facture de commission NF (aucun concurrent du panel).
- **Trust accounting réel & inclus** : `Wallet` (PLATFORM/OWNER/CONCIERGE/ESCROW) + `LedgerEntry` en partie double + `EscrowHold` + `SplitPaymentService` (parité Guesty, **sans surcoût premium**).
- **Reversements multi-propriétaires** : 4 rails payout (Stripe Connect, Wise 80+ pays, Open Banking PIS, SEPA pain.001) + `ManagementContract` (4 modèles de paiement).
- **Opérations terrain** : pipeline check-out→ménage auto + auto-assignation géographique + app mobile native (85 écrans, offline MMKV, signature).
- **Calendrier transactionnel anti-overbooking** (verrou `pg_advisory` + write-ahead log + outbox Kafka) ; multi-tenant fail-closed.
- **Socle IA moderne** : assistant multi-provider + RAG pgvector 2-stage + 27 tools + mémoire (supérieur aux PMS classiques sur le conversationnel).
- **Moteur Ménage économique (unique sur le marché, 2026-07)** : prix conseil calculé + tarifs prestataires cadrés + paiement à la complétion gaté par preuve photo + anomalies monétisées. Aucun PMS ne couvre cette chaîne en natif (cf. §3bis).
- **Constellation d'agents à autonomie graduée (déployée, 2026-07)** : multi-agents Finance/Ops/Revenue/Com/Réputation avec cartes HITL, feed temps réel, et **autonomie déterministe opt-in** gagnée par l'historique (Règles de Confiance) — un cran au-dessus de l'« IA conversationnelle » des concurrents.

### Faiblesses (preuves code)
- ~~Capacités IA désactivées~~ **→ LEVÉE (2026-07)** : la constellation multi-agent est **déployée** ; reste à activer/exposer : autopilot messagerie, insight IA reporting, comparaison N/N-1.
- **Channel = modèle revendeur (Channex)** sans statut partenaire OTA fort ; OTAs longue traîne et MENA en stub.
- **Booking engine sans site builder/SEO** → affaiblit la promesse « moins d'OTA ».
- **Communication** : SMS absent, pas d'autopilot, pas de KB messagerie.
- ~~Caution/dépôt absent~~ **→ LEVÉE partiellement (2026-07)** : libération de caution (release/refund, hold Stripe) livrée et automatisable ; reste à finaliser la **prise de caution** à la réservation + **KYC voyageur** (stubs).
- **Intégrations** : marketplace en dur, **pas de Zapier/Make**, QuickBooks/Xero/Sage sans sync.
- **Pricing produit sous-optimal** (par siège vs marché par logement → forte sous-valorisation sur la cible conciergerie).
- **Pas de certification SOC 2 / ISO 27001** ; 2FA non exposée en produit.

### Opportunités
- **Vague réglementaire FR/UE** comme accélérateur : loi Le Meur (registre national 20/05/2026), règlement UE 2024/1028 (20/05/2026), **facturation électronique Factur-X** (GE/ETI 09/2026, PME 09/2027).
- **Conciergeries sous-outillées** sur le back-office → marché B2B2C adressable.
- **Direct booking** comme levier anti-commission OTA (si le booking engine est complété).
- **Déverrouillage IA** : activer l'existant pour rattraper la perception « PMS IA-natif ».
- **Trust accounting/reversements** : besoin marché sous-servi hors Guesty.

### Menaces
- **Consolidation** (Hostaway licorne 2025, HomeToGo↔Interhome) → course au capital et aux features.
- **Banalisation de l'IA** (Guesty « built on AI », Hospitable, AI-natifs Jurny/Enso).
- **Désintermédiation OTA** (co-hosting Airbnb, partenariat Airbnb↔Guesty) — *signal à vérifier*.
- **Contraction du parc STR FR** (loi Le Meur, plafond 120 nuits) → TAM amateur réduit.
- **Écart marketing/réalité** (« 4 QTSP FR », « 39 €/bien », SMS) = risque de crédibilité commerciale.

---

## 5. Carte de positionnement

**Axe X = couverture fonctionnelle (breadth, score pondéré) · Axe Y = spécialisation conciergerie/conformité FR (profondeur back-office + fiscalité).**

```
Spécialisation conciergerie / conformité FR (haut = fort)
  ▲
  │                                   ● BAITLY
  │                                  (2.31 ↑ ; spécialisation très haute, 2 moats)
  │
  │        ● Avantio
  │        ● Smily
  │                         ● Guesty (2.52 ; spécialisation moyenne+)
  │   ● Smoobu              ● Hostaway (2.31)
  │              ● Lodgify   ● Hospitable
  │
  └────────────────────────────────────────────────►
        Couverture fonctionnelle (breadth) →
```

- **Baitly occupe un coin distinct** : breadth moyenne mais **spécialisation conciergerie/conformité FR la plus haute du panel**. C'est une position de **niche défendable**, pas une position de leader généraliste.
- Guesty/Hostaway dominent la breadth ; aucun n'occupe le coin « conformité FR + back-office conciergerie ».
- **Risque :** rester coincé au milieu sur la breadth (« stuck in the middle ») si la niche n'est pas assumée ET monétisée.

---

## 6. Conclusion de positionnement (une phrase)

> **Baitly n'est pas le PMS le plus complet du marché — il est le PMS le plus complet pour faire tourner une conciergerie en conformité (reversements, fiscalité NF, terrain), et désormais le seul à offrir en natif un pilotage économique du ménage de bout en bout.**
>
> *Mise à jour 2026-07 :* la thèse de juin reposait sur un moat (conformité FR) + une promesse (« déverrouiller l'IA »). Aujourd'hui l'IA est **déverrouillée** (constellation déployée + autonomie déterministe) et un **2ᵉ moat** est né (Moteur Ménage, §3bis). Baitly passe **6ᵉ → 3ᵉ** (2.31, à égalité Hostaway). Restent à traiter : **pricing produit sous-valorisé** (par siège vs marché par logement — la faiblesse la plus coûteuse), autopilot messagerie, statut partenaire OTA, booking engine/SEO.
