# Benchmark B4 — Opérations (Ménage & Maintenance) + Application mobile

> **Domaines :** 5 (Opérations) + 11 (Application mobile) • **Date :** 2026-06-13
> **Cible Clenzy :** conciergeries / gestionnaires pro B2B2C, ancrage France.
> **Grille 0–3 :** 0 absent / 1 basique-contournement / 2 standard marché / 3 avancé-différenciant.
> **Confiance source :** `Confirmé` (doc éditeur/help center) / `Probable` (comparatif tiers récent) / `À vérifier` (indice indirect).
> **Référentiel de profondeur ops :** Breezeway, Turno (ex-TurnoverBnB), Operto Teams — spécialistes hors panel PMS, cités comme plafond de maturité.

---

## Section 1 — Synthèse exécutive

**Domaine 5 (Opérations).** Clenzy se positionne **au-dessus du standard PMS** sur l'exécution native : 19 types d'intervention, machine à états avec étape de facturation, photos avant/après/anomalie, **auto-assignation par zone géographique + type + disponibilité**, et surtout un **déclenchement automatique du ménage depuis le check-out iCal** (`ICalCleaningScheduler`) avec retry planifié et auto-assignation post-commit. Ce niveau de routing natif est rare chez les PMS généralistes, qui **délèguent massivement la profondeur ops aux spécialistes** (Turno, Breezeway, Operto, Doinn, Cleanster, ResortCleaning). Le vrai plafond du marché est tenu par ces spécialistes (checklists custom par unité, photos de référence, optimisation, marketplace de cleaners vérifiés). **Gaps Clenzy :** ticket d'anomalie de premier ordre (entité `Issue`→bon de travail), checklists custom par unité, optimisation de tournée, et surtout **marketplace de sourcing de prestataires** (absent — `MarketplaceService` est un catalogue d'intégrations, pas un vivier de cleaners).

**Domaine 11 (Mobile).** Clenzy dispose d'une **app native React Native/Expo à double couverture** (85 écrans : gestion nomade *et* exécution terrain), avec **offline robuste** (file de mutations testée, retry/dépendances/auto-flush + MMKV + cache persistant), push natif et OTA EAS. C'est **au-dessus de la médiane PMS**, où l'on trouve plutôt soit une app host de consultation (Hostaway, Smily, Hospitable), soit le renvoi vers une app cleaner tierce (Smoobu→Turno/Properly, Lodgify→Turno/Doinn). **Réserve :** la biométrie annoncée n'est **pas implémentée** (dépendance dormante) ; aucun concurrent n'expose publiquement offline/biométrie non plus → la barre marché y est basse.

---

## Section 2 — Méthode & panel

- **Inventaire Clenzy :** `inventaire/05-operations.md`, `inventaire/11-mobile.md` (preuve fichier:ligne).
- **Concurrents PMS (panel imposé) :** Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily (ex-BookingSync).
- **Spécialistes ops (référentiel, hors scoring panel) :** Breezeway, Turno, Operto Teams (+ mentions Doinn, Cleanster, ResortCleaning, Properly).
- **Sourcing :** documentation éditeurs + help centers + comparatifs tiers 2025-2026 (voir Section 7).
- **Règle :** « non documenté » si introuvable ; pas d'extrapolation ; reformulation systématique.

---

## Section 3 — Domaine 5 : Opérations Ménage & Maintenance

### 3.1 Lecture par acteur

**Clenzy (3).** Pipeline natif checkout→ménage→auto-assign géo→retry ; 19 types ; photos BEFORE/AFTER/ISSUE ; checklist mobile par pièce + chrono. Gaps : ticket anomalie 1er ordre, checklist custom par unité, marketplace cleaners, e-sign légale du bon de travail.

**Hostaway (≈2,5).** Tâches déclenchées à la confirmation/au checkout, **cleanliness status auto** (Clean/Not Clean au passage du check-out), auto-assign + rappels/instructions au cleaner, app cleaner ; **marketplace de 300+ intégrations** incl. cleaning/maintenance (mais marketplace d'*intégrations*, sourcing de cleaners délégué à Turno/Properly). *(Confirmé, support.hostaway.com, 2025.)*

**Guesty (≈2,7).** **Tâches auto post-checkout** (déclenchement « at check-out » / « 2h avant check-in »), **checklists** (items cochables sur mobile), **photos avant/après + doc de dommage**, notifications instantanées au cleaner, **task routing avancé** (plan Pro). Le plus complet du panel sur le natif. *(Confirmé, help.guesty.com + guesty.com/blog, 2025-2026.)*

**Smoobu (≈1,5).** **Comptes assistants** pour cleaners/staff (lecture illimitée gratuite, écriture **15 €/compte/mois**) ; profondeur ménage **déléguée aux intégrations** (Turno, Properly, ResortCleaning) : checklists photo, paiements, inventaire, issue reporting viennent des partenaires. *(Confirmé, support.smoobu.com, 2025.)*

**Lodgify (≈2).** **Task management natif** (tâches récurrentes + spécifiques, assignation multi-rôles, app PM Modules) mais turnover cleaning **délégué** (Turno, Cleanster — backup cleaner + sync 60 j, Doinn, ResortCleaning, TIDY). *(Confirmé, lodgify.com/task-management + pages intégrations, 2025.)*

**Hospitable (≈2,3).** Workflows déclenchés par actions guest (booking/checkout), assignation cleaners/maintenance/co-hosts, **paiement direct des prestataires**, et **marketplace de cleaners natif** (seul du trio Smoobu/Lodgify/Hospitable à l'offrir). Profil plutôt « communication + coordination » que checklist/photo profonde. *(Probable, hospitable.com + comparatifs 2025-2026.)*

**Avantio (≈2,3).** Outil **operations management natif** : auto-création/assignation cleans/inspections/réparations depuis réservations, **règles de tâches récurrentes**, **templates de checklist**, comm. prestataires ; owner statements. Profondeur ménage aussi via partenaire **PropertyCare.com** (API). *(Confirmé, avantio.com/operations-management-tool + propertycare.com, 2025-2026.)*

**Smily / ex-BookingSync (≈2).** **Task management ajouté en Dec. 2025** : planifier ménage/checks/maintenance, suivre progression, notifier équipes, **tâches déclenchées par statut de séjour** ; profondeur ops via **Breezeway** + **SuiteOp**. Maturité récente → confiance modérée. *(Confirmé pour l'existence, changelog.bookingsync.com 05-12-2025 ; profondeur À vérifier.)*

### 3.2 Référentiel spécialistes (plafond de maturité — hors scoring)

| Spécialiste | Profondeur observée |
|-------------|---------------------|
| **Breezeway** | Checklists **custom par unité**, **photos de référence** (« voilà à quoi ça doit ressembler »), upload photo obligatoire, **sync offline sans WiFi**, app iOS/Android **10-12 langues**, suivi durée + progression live, **rapports PDF/liens partageables** aux propriétaires, IA messaging. *(Confirmé, breezeway.io, 2025.)* |
| **Turno (ex-TurnoverBnB)** | **Marketplace de cleaners vérifiés** (dizaines de milliers), **auto-scheduling** depuis le calendrier de réservations (primaire + backup), **photo-checklists horodatées**, paiements, suivi temps réel. *(Confirmé, turno.com, 2025.)* |
| **Operto Teams** | Checklists **custom par unité**, **photos/vidéos obligatoires**, automatisation scheduling complexe, vue propriétaire contrôlée. *(Confirmé, operto.com, 2025.)* |

> **Lecture :** Clenzy **rivalise avec les spécialistes sur l'exécution** (auto-assign géo, photos, checklist par pièce, chrono) mais **reste en-dessous** sur : checklist custom par unité, photos de référence, optimisation, et **n'offre aucun marketplace de sourcing de cleaners** (différenciateur n°1 de Turno).

---

## Section 4 — Domaine 11 : Application mobile

### 4.1 Lecture par acteur

**Clenzy (3).** App **native** RN/Expo, **double couverture** (gestion + terrain, 85 écrans), **offline mutations testé** (retry/dépendances/auto-flush) + MMKV + cache persistant, push natif, **OTA EAS**, token au repos en `expo-secure-store`. Réserve : **biométrie non câblée** (dépendance présente, code absent).

**Hostaway (≈2).** App iOS + Android **orientée actions rapides** (ajuster prix, messages guest, déléguer maintenance), tâches/automatisation, calendrier ; note ~4,8 (1 352 avis). Pas d'évidence publique offline/biométrie. *(Confirmé existence + orientation, stayfi 2025 + hostaway.com.)*

**Guesty (≈2,3).** Apps iOS/Android **plus « natives »/polies** (meilleur design, couverture features plus large que Hostaway selon comparatifs), app cleaner avec checklists/photos. Offline/biométrie **non documentés**. *(Probable, softwaresuggest + rentalduel 2025.)*

**Smoobu (≈1,5).** App host de gestion + **comptes assistants** pour cleaners ; profondeur terrain renvoyée aux partenaires. Native iOS/Android **non détaillé** publiquement. *(À vérifier sur le volet app native ; comptes cleaner Confirmé.)*

**Lodgify (≈2).** **App native « PM Modules »** (Google Play) couvrant tâches + coordination d'équipe (check-in agents, cleaners, managers, admins) ; turnover délégué. *(Confirmé existence Play Store + lodgify.com/task-management.)*

**Hospitable (≈2).** App iOS/Android (« super app » host) centrée **communication multi-canal + reminders équipe** ; marketplace cleaner + paiement in-app. Orientation host/communication. *(Confirmé existence App Store/Play ; orientation Probable.)*

**Avantio (≈1,5).** App mobile existante mais **UX mobile explicitement en cours d'amélioration** (« work still being done » selon HotelMinder). Couverture terrain dédiée **non documentée**. *(Confirmé limitation UX, hotelminder.com 2026.)*

**Smily (≈2).** **App mobile incluse** dans l'abonnement : inbox centralisé, avis, gestion des tâches (ménage/maintenance/check-in-out) — alignée avec le task management de Dec. 2025. Offline/biométrie **non documentés**. *(Confirmé existence + tâches, smily.com/software/features/mobile-app.)*

> **Constat marché mobile :** **aucun** acteur du panel ne **documente publiquement** d'offline avancé ou de biométrie. La barre est basse ; Clenzy se distingue surtout par (a) la **double couverture gestion+terrain native** et (b) un **offline de mutations testé**. La biométrie n'est pas un facteur différenciant marché (personne ne la met en avant) — mais Clenzy doit **soit la câbler, soit retirer la promesse**.

---

## Section 5 — Sous-matrices de scoring

### 5.1 Sous-matrice — Domaine 5 (Opérations)

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily | Confiance |
|----------------|:------:|:--------:|:------:|:------:|:-------:|:----------:|:-------:|:-----:|-----------|
| Ménage auto déclenché au checkout | 3 | 3 | 3 | 1 | 2 | 3 | 3 | 2 | Confirmé |
| Auto-assignation cleaner/équipe | 3 | 2 | 3 | 1 | 2 | 2 | 3 | 2 | Confirmé |
| Routing géographique (zone+type+dispo) | 3 | 1 | 2 | 0 | 1 | 1 | 1 | 1 | Probable |
| Checklists de ménage/inspection | 2 | 2 | 3 | 1 | 2 | 1 | 2 | 2 | Confirmé |
| Checklist **custom par unité** | 1 | 2 | 2 | 0 | 1 | 1 | 2 | 1 | Probable |
| Photos avant/après | 3 | 2 | 3 | 1 | 1 | 1 | 2 | 1 | Confirmé |
| Signalement d'anomalie / ticket maintenance | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | Probable |
| Gestion d'équipes / staff | 3 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | Confirmé |
| Paiement des prestataires intégré | 2 | 2 | 2 | 1 | 1 | 3 | 2 | 1 | Probable |
| App terrain dédiée cleaner/tech | 3 | 2 | 2 | 1 | 2 | 1 | 1 | 2 | Probable |
| **Marketplace de sourcing de cleaners** | 0 | 1 | 1 | 0 | 0 | 3 | 0 | 0 | Probable |
| Rapports propriétaire d'exécution (PDF/lien) | 2 | 2 | 2 | 1 | 1 | 1 | 2 | 1 | À vérifier |

> Note : « Marketplace » distingue **catalogue d'intégrations** (Hostaway/Guesty/Smily délèguent via marketplace de partenaires → 1) du **vivier de cleaners vérifiés à booker** (Hospitable natif → 3 ; Turno = la référence hors panel). Clenzy = 0 (catalogue d'intégrations uniquement, pas de cleaners).

### 5.2 Sous-matrice — Domaine 11 (Mobile)

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily | Confiance |
|----------------|:------:|:--------:|:------:|:------:|:-------:|:----------:|:-------:|:-----:|-----------|
| App native iOS + Android | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | Confirmé |
| Couverture gestionnaire (gestion nomade) | 3 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | Confirmé |
| Couverture terrain (cleaner/tech dédié) | 3 | 2 | 2 | 1 | 2 | 1 | 1 | 2 | Probable |
| Mode offline (lecture + mutations) | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | À vérifier |
| Notifications push | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Confirmé |
| Mises à jour OTA (sans store) | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | À vérifier |
| Capture de signature mobile | 2 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | À vérifier |
| Biométrie (login/verrou) | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 1 | À vérifier |
| Token au repos sécurisé (Keychain/Keystore) | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Probable |
| Qualité/polish perçu (avis stores) | 2 | 3 | 3 | 2 | 2 | 2 | 1 | 2 | Probable |

> Note : offline avancé, OTA et signature **ne sont pas documentés publiquement** chez les concurrents → scores prudents (1) en « standard implicite par défaut », confiance « À vérifier ». Le différenciateur réel et **vérifié par le code** de Clenzy est la **double couverture + offline de mutations**.

---

## Section 6 — Gaps, avantages, parités & initiatives

### 6.1 Domaine 5 — Opérations

**Top 3 gaps**
1. **Pas de marketplace de sourcing de cleaners** (Turno/Hospitable l'ont) — `MarketplaceService` n'est qu'un catalogue d'intégrations.
2. **Pas de ticket d'anomalie de premier ordre** : signalement existe (mobile + photo ISSUE) mais sans entité `Issue`/`Defect` → bon de travail avec son cycle de vie (Breezeway, Guesty, Hospitable mieux dotés).
3. **Checklists custom par unité absentes** (templates codés par pièce, pas configurables par le gestionnaire) ; pas de photos de référence ni d'optimisation de tournée.

**Top 3 avantages**
1. **Routing géographique natif** (zone + type + disponibilité) — rare en PMS généraliste, généralement délégué.
2. **Pipeline checkout→ménage auto + retry planifié + post-commit** (`ICalCleaningScheduler` + `AutoAssignScheduler`), timezone-propriété correcte.
3. **Profondeur de typage (19 types) + machine à états avec étape de facturation** intégrée au flux conciergerie (facturation du ménage au propriétaire).

**Parités** : déclenchement auto checkout (≈ Hostaway/Guesty/Avantio/Hospitable), checklists de ménage (≈ standard), photos avant/après (≈ Guesty), gestion d'équipes (≈ Guesty).

### 6.2 Domaine 11 — Mobile

**Top 3 gaps**
1. **Biométrie annoncée mais non câblée** (dépendance dormante) — incohérence promesse/code à résoudre.
2. **Polish/perception stores** : Hostaway (~4,8) et Guesty sont perçus plus « natifs/polis » ; Clenzy n'a pas de signal d'avis public.
3. **Pas de marketplace cleaner in-app** ni de paiement prestataire in-app aussi fluide qu'Hospitable.

**Top 3 avantages**
1. **Double couverture native gestion + terrain** (85 écrans) — la plupart des PMS ont une app host de consultation OU délèguent le terrain à une app tierce.
2. **Offline de mutations testé** (file persistante, retry/dépendances/auto-flush) — au-dessus du simple cache de lecture, non documenté chez les concurrents.
3. **OTA EAS** : patch instantané sans repasser par les stores.

**Parités** : app native iOS/Android (≈ Hostaway/Guesty/Lodgify/Hospitable/Smily), push (≈ standard), token sécurisé (≈ standard implicite).

### 6.3 Initiatives recommandées

| Titre | Type | Impact | Effort | Reach | Confiance |
|-------|------|:------:|:------:|:-----:|:---------:|
| Ticket d'anomalie de 1er ordre (`Issue`→bon de travail, cycle de vie, conversion depuis phase ISSUE) | Ops | 3 | M | 3 | 0.8 |
| Checklists custom par unité + photos de référence (config gestionnaire) | Ops | 2 | M | 3 | 0.8 |
| Câbler la biométrie (`expo-local-authentication`) OU retirer la promesse | Mobile | 2 | S | 2 | 0.9 |
| Marketplace/annuaire de prestataires (sourcing cleaners + backup auto) | Ops | 3 | L | 2 | 0.6 |
| Optimisation de tournée (ordonnancement géo des missions du jour) | Ops/Mobile | 2 | M | 2 | 0.6 |

---

## Section 7 — Sources

**Hostaway**
- [Best Vacation Rental Cleaning Management Tools 2025](https://www.hostaway.com/blog/best-vacation-rental-cleaner-management-tools/)
- [Tasks: Listing Cleanliness Status](https://support.hostaway.com/hc/en-us/articles/10276672065563-Tasks-Listing-Cleanliness-Status)
- [What Automation Tools Improve Cleaning Team Coordination](https://www.hostaway.com/blog/automate-cleaning-tasks/)
- [Hostaway Marketplace](https://www.hostaway.com/marketplace/) • [Marketplace partners (support)](https://support.hostaway.com/hc/en-us/articles/4406922627611-Hostaway-Marketplace-Your-Gateway-to-Powerful-Integrations)
- [Hostaway App Review (StayFi, oct. 2025)](https://stayfi.com/vrm-insider/2025/10/28/hostaway-app-review/)

**Guesty**
- [Zero-chaos cleaning schedule: automate turnover 2025](https://www.guesty.com/blog/zero-chaos-cleaning-schedule-automate-turnover-operations/)
- [Automate cleaning schedules 2026](https://www.guesty.com/blog/automate-cleaning-strs/)
- [Managing tasks (Help Center)](https://help.guesty.com/hc/en-gb/articles/9370553270941-Managing-tasks)
- [Guesty PMS Review (StayFi, nov. 2025)](https://stayfi.com/vrm-insider/2025/11/03/guesty-pms-review/)
- [Guesty Mobile app for iOS/Android 2025](https://www.softwaresuggest.com/guesty/mobile-app)

**Smoobu**
- [Assistant accounts for cleaning team](https://support.smoobu.com/hc/en-us/articles/360003170860-How-do-I-create-Assistant-accounts-for-my-cleaning-team-staff-partners-and-Owners)
- [Housekeeping/Task/Cleaning Management Integrations](https://support.smoobu.com/hc/en-us/articles/4403358216978-Housekeeping-Task-Cleaning-Management-Integrations)
- [Smoobu & Turno integration](https://www.smoobu.com/en/integrations/turno/) • [Smoobu & Properly](https://www.smoobu.com/en/integrations/properly/)

**Lodgify**
- [Task Management for Vacation Rentals](https://www.lodgify.com/task-management/)
- [Lodgify & Turno](https://www.lodgify.com/integrations/turnoverbnb/) • [Cleanster](https://www.lodgify.com/integrations/cleanster/) • [Doinn](https://www.lodgify.com/integrations/doinn/) • [ResortCleaning](https://www.lodgify.com/integrations/resort-cleaning/)
- [Lodgify: PM Modules (Google Play)](https://play.google.com/store/apps/details?id=com.rn.ninja_app_lodgify)

**Hospitable**
- [Hospitable — Super App for Hosts](https://hospitable.com/)
- [Lodgify vs Smoobu vs Hospitable (operational lead, cleaner marketplace)](https://hospitable.com/compare/lodgify-vs-smoobu)
- [App Store](https://apps.apple.com/us/app/hospitable-com/id1475679185) • [Google Play](https://play.google.com/store/apps/details?id=com.smartbnb.smartbnb)

**Avantio**
- [Operations management tool](https://www.avantio.com/operations-management-tool/) • [Automate property management 2026](https://www.avantio.com/blog/automate-property-management/)
- [Avantio + Doinn partnership](https://doinn.co/blog/avantio-doinn-cleaning-automation-integration/) • [PropertyCare housekeeping](https://www.propertycare.com/avantio-housekeeping/)
- [Avantio Pricing/Reviews (HotelMinder, mobile UX limitation)](https://www.hotelminder.com/partner=Avantio)

**Smily (ex-BookingSync)**
- [Smily Mobile App](https://www.smily.com/software/features/mobile-app)
- [SuiteOp now available with Smily (changelog)](https://changelog.bookingsync.com/suiteop-is-now-available-with-smily!-315345)
- [Smily ❤️ Breezeway integration](https://www.breezeway.io/breezeway-smilybookingsync-integrations)

**Spécialistes ops (référentiel)**
- [Breezeway — Operations Platform](https://www.breezeway.io/operations-platform) • [Checklists mobile app](https://www.breezeway.io/checklists-mobile-app) • [Housekeeping software](https://www.breezeway.io/housekeeping-software)
- [Turno — Cleaner Marketplace](https://turno.com/features/cleaner-marketplace/) • [Auto-Scheduling](https://turno.com/features/auto-scheduling/) • [Photo Checklists](https://turno.com/features/photo-checklists/)
- [Operto Teams](https://operto.com/teams/) • [Operto — VR cleaning & maintenance 2025](https://operto.com/blog/vacation-rental-cleaning/)
