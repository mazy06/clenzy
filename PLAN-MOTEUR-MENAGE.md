# Chantier — Moteur Ménage Baitly

> Décision produit du 2026-07-10 (« paquet proposé validé »). Ce document est la source de vérité du chantier.
> Statuts : ⬜ à faire · 🔶 en cours · ✅ fait+vérifié · ⏸ différé

## Décisions actées

1. **Option B retenue** : moteur de prix conseil ménage **unifié**, orienté travail réel.
2. **Formule** : `minutes normées (par composant du logement) × taux horaire de référence org × multiplicateur type de ménage (express/standard/deep) → prix conseillé + fourchette min/max`. **Un seul calcul produit la durée ET le prix.**
3. **3 étages de prix** :
   - Conseil plateforme (moteur, fourchette) — snapshoté sur chaque intervention (`recommended_cost`).
   - Prix du logement (`cleaningBasePrice`, existant) — l'hôte adopte ou personnalise le conseil.
   - Tarif du prestataire (`housekeeper_rate`, nouveau) — taux horaire **et/ou** forfait par propriété, **le forfait primant** (pattern Turno : attaché au couple propriété×prestataire).
4. **Résolution du prix d'une intervention** : tarif (propriété, housekeeper) → taux horaire pro × durée normée → prix du logement → médiane conseil.
5. **Cadrage = nudge, jamais de blocage** (pattern Upwork/Turno). Ancrage visuel sur la **médiane**, pas le plancher (leçon Airbnb Smart Pricing).
6. **Calibration** : le taux horaire de référence par défaut est calibré pour que les tarifs actuels restent stables (référence : Appartement Duplex Marrakech ≈ 95 €).
7. Communications : paquet P1/P2/P3/P4/P5/P8/P9/P10/P11 validé ; **P6 (WhatsApp terrain) et P7 (préférence de canal) différés**.

## Contexte (constats d'audit, 2026-07)

- 3 formules divergentes : `estimateCleaningCost` (backend, forfait×coeffs — quasi non branché), `QuoteController.computePrice` (devis landing), `CleaningPriceEstimator` (front, jamais persisté). → **le moteur unifié les remplace toutes**.
- Les flux réels (ménage post-checkout `ServiceRequestService:896`, réservations `ReservationService:637`, imports OTA) posent `cleaningBasePrice` brut.
- `estimatedCost` = champ fourre-tout (conseil + facturé + analytics). Le snapshot `recommended_cost` sépare enfin conseil et pratiqué.
- Aucun tarif housekeeper nulle part ; mobile terrain en lecture seule ; durée jamais reliée au prix.
- Push mobile **orphelin** (`FcmNotificationConsumer` sans producteur) ; aucun email d'assignation ; WhatsApp 100 % guest.
- Positionnement : **aucun PMS ne calcule un prix conseil ménage** (benchmark 2026-07). Superhote = concurrent FR le plus proche (tarif/prestataire + dû auto) mais sans conseil ni payout ni gate photo.

## Phase 1 — Moteur unifié

| # | Item | Statut |
|---|---|---|
| 1A | **Moteur backend** `CleaningPricingEngine` : minutes normées par composant (port du `computeEstimatedDuration` front) × taux horaire org × multiplicateurs type de ménage → `{minutes, recommended, min, max}` par type. Config JSON dans `PricingConfig` (réglable admin). Calibration Marrakech ≈ 95 € (42 €/h, profil supposé 2ch/1sdb/2 niveaux — ⚠️ à revérifier DB). Résolveur `resolveCleaningPrice`. Endpoints : estimate résolu, batch, **preview** (décomposition minutes). Migrations 0336/0337, snapshot `recommended_cost` (SR + Intervention). Injections remplacées (`ICalCleaningScheduler`, `ServiceRequestService`, `ReservationService`) ; ancien `estimateCleaningCost` supprimé. 14 tests moteur, `mvn package` complet vert. | ✅ |
| 1B | **Surfaces front** : `CleaningPriceEstimator` v2 sur preview (formules locales supprimées, décomposition minutes, ancre médiane, bouton « Adopter comme prix du logement ») ; onglet **Ménage** dans Tarification (TabMenage : temps de travail / taux & arrondis / multiplicateurs + simulateur « grille enregistrée ») ; `cleaningEngineConfig` exposé DTO + persisté via PUT existant ; i18n fr/en/ar. | ✅ |
| 1C | **P1** 4 tags documents (`prix_conseil`, `fourchette`, `decomposition`, `duree_normee`, fallback chaîne vide) · **P3** devis prospect sur le moteur (facteur package 0.9/1.0/1.15, sur-couche count/frequency conservée, shape réponse inchangé) · **P11** relevé propriétaire : « Barème conseillé : X € » ou « conforme au barème » (tolérance 5 €). Vérif globale : `mvn package` complet + `tsc` = 0. | ✅ |

**Phase 1 TERMINÉE (2026-07-10)** — moteur unique partout, fin des 3 formules divergentes. Non committée. ⚠️ Reste : revérifier la calibration Marrakech contre la DB dev (containers éteints pendant 1A) + test navigateur (rebuild pms-server requis pour les nouveaux endpoints).

## Phase 2 — Tarifs pros + canaux terrain

| # | Item | Statut |
|---|---|---|
| 2A | Table `housekeeper_rates` (migration 0338 : HOURLY par user + FLAT par propriété primant, unicité via index partiels), résolveur étendu (source `HOUSEKEEPER_RATE`, types dérivés par ratio de multiplicateurs), application à l'assignation avec gardes (jamais après paiement/validation ; auto-assign NON câblé — pose des équipes, pas des users), endpoints me/admin (ownership JWT fail-closed), onglet « Mes tarifs » dans Réglages (nudge fourchette, badge « dans le marché », jamais bloquant), badge barème sur détail intervention. 21 tests. ⏸ différé : vue manager depuis fiche membre (backend prêt). | ✅ |
| 2B | **P4** push réparé : producteur outbox → `notifications.send` (whitelist 5 clés terrain, post-commit, échec Kafka n'affecte pas l'in-app) ; infra tokens `device_tokens` préexistait (réutilisée) ; mobile CÂBLÉ (usePushNotifications monté au login, désenregistrement au logout, deep-links) · **P5** `MissionAssignmentEmailComposer` post-commit (rémunération résolue + mention barème, pas de codes d'accès, préférence notif respectée) · **P2** montants dans les notifs (pro = rémunération ; owner/admins = facturé). 8 tests. | ✅ |

**Phase 2 TERMINÉE (2026-07-10)** — vérifiée (`mvn package` complet + `tsc` client + `tsc` mobile = 0). Non commitée.

## Phase 3 — Boucle opérationnelle

| # | Item | Statut |
|---|---|---|
| 3A | **P8** `DocumentType.DEVIS_MENAGE` : template `devis-menage-clenzy.odt` (fabriqué depuis devis-clenzy, mimetype 1ʳᵉ entrée STORED, smoke test rendu XDocReport), tags `${menage.*}` via `CleaningQuoteTagBuilder` injecté dans PropertyTagResolver (contrat « jamais de tag manquant »), `POST /api/documents/cleaning-quote/{propertyId}` (org fail-closed, 422 owner sans email) → pipeline outbox → email owner, bouton « Devis ménage » dans le header PropertyDetails (garde canEdit). Aucune migration. | ✅ |
| 3B | **P9** payout du pro (arbitré : Express EMBARQUÉ + gate photo + commission `entretien` de commissionConfigs, défaut désactivée) : migration 0340 (`housekeeper_payout_configs` + `records` UNIQUE(intervention_id)), `HousekeeperPayoutConfig` miroir (owners intouchés, webhook account.updated dispatché aux 2), accrochage `completeIntervention` (host PAID → preuve = ≥1 photo AFTER persistée → onboarding → net>0 ; BLOCKED avec raison, jamais silencieux), transfert afterCommit idempotent (`payout-intervention-{id}`) + CAS PENDING→SENT/FAILED via bean `HousekeeperPayoutRecorder` (anti auto-invocation @Transactional), retry staff re-gaté, notifs PAYOUT_SENT (push)/FAILED/BLOCKED_ONBOARDING, onglet « Mes versements » (`@stripe/connect-js ^3.4.6`, onboarding embarqué). 15 tests. ⏸ différé : vue admin payouts (endpoints+API prêts). ⚠️ **Vérification Stripe test-mode REQUISE avant déploiement.** | ✅ |
| 3C | **P10** anomalie terrain → entité `Issue` (migration 0339, OPEN→QUALIFIED→CONVERTED\|DISMISSED, conversion = UPDATE conditionnel) → SR MAINTENANCE pré-chiffrée via catalogue travaux (match interventionType/label puis domaine) → notifs `ISSUE_REPORTED` (push) / `ISSUE_CONVERTED` (owner). Mobile `AnomalyReportScreen` branché sur `POST /api/issues` + photos phase ISSUE ; onglet « Anomalies » dans WorkOrdersPage (gestionnaires). 20 tests, tsc client+mobile = 0. | ✅ |
| 3D | **Score qualité** `HousekeeperScoreService` (30 j glissants, `score = proofRate × min(1, complétées/5) × 100`, zéro mission → 0, sans table) exposé dans « Mes tarifs » + vue admin · **Auto-assignation du meilleur pro** : après le choix d'équipe existant (inchangé), promotion du meilleur membre housekeeper (score → proximité médiane conseil → charge du jour), toggle org `autoAssignBestPro` **défaut false** (opt-in TabMenage), jamais d'écrasement d'un user assigné · **Majorations saisonnières** : `seasonalModifiers` (fenêtres MM-JJ avec wrap d'année, premier match), `quote(..., serviceDate)` aux créations datées — s'applique au CONSEIL seulement (jamais aux tarifs négociés FLAT/HOURLY), signatures sans date inchangées (non-régression 95 €), UI TabMenage + simulateur daté. 20 tests. | ✅ |

**Phase 3 TERMINÉE (2026-07-11)** — vérification globale fraîche : `mvn package` complet + `tsc` client + `tsc` mobile = 0. Non commitée. ⚠️ 3B : Stripe test-mode requis avant déploiement.

## Phase 4 — Alignement frontend (audit 2026-07-11)

> Issue de l'audit croisé couverture backend→front + organisation UX. Constats majeurs : mobile pro en retard sur le backend ; registres hardcodés (tags, préférences notifs) non mis à jour.

| # | Item | Statut |
|---|---|---|
| 4A | **Web** : 11 items livrés — tags découvrables (4 `${intervention.*}` + catégorie « Devis ménage » 11 tags) · préférences notifs ISSUE_*/PAYOUT_* togglables · création anomalie web (dialog, catégories miroir mobile, sévérité 4 niveaux) · CTA PROOF_MISSING → détail mission + scroll onboarding · source HOUSEKEEPER_RATE rendue · **vue manager tarifs+score = dialog depuis UsersList (différé 2A levé)** · constante `constants/roles.ts` + hasAnyRole · sous-titres + libellés désambiguïsés (« Reversements propriétaire / Mes versements de missions / Reversements (plateforme) ») · deep-link vue simple OK · erreurs simulateur · commentaires corrigés. tsc=0, zéro backend. Écart assumé : AvailableTagsReference/NotificationPreferencesCard/menu UsersList restent FR-en-dur (style des fichiers, i18n-isation = chantier séparé). | ✅ |
| 4B | **Mobile pro** : 3 écrans `shared/` (MyRates avec score+nudge, MyPayouts avec onboarding **AccountLink navigateur in-app** + CTA PROOF_MISSING→checklist, MyIssues lecture seule) enregistrés dans les ProfileStacks Housekeeper **et** Technician, groupe « Espace pro » du Profile · backend : `POST /housekeeper-payouts/onboarding-link` (ensureExpressAccount factorisé) + `GET /issues?mine=true` + PAYOUT_BLOCKED_ONBOARDING push-whitelisté · « Montant des missions » (fin de la sémantique gains) + badge barème sur détail mission (`recommendedCost` type mobile) · deep-links PAYOUT_*/ISSUE_* + linking.ts · sévérité 4 niveaux · **ar.json mobile complet (156 clés, miroir vérifié)** + AnomalyReportScreen i18n-isé. ⏸ RTL layout hors scope (traductions livrées). 12 637 tests verts. | ✅ |

**Phase 4 TERMINÉE (2026-07-11)** — parité web+mobile sur tout le chantier. Non commitée (avec Phase 3).

## Différés

- **P6** templates WhatsApp terrain (Meta UTILITY) — si demande des pros.
- **P7** préférence de canal par utilisateur — YAGNI tant que push+email suffisent.
- Marketplace de sourcing de prestataires — hors modèle B2B conciergerie (fondations posées par le score 3D).
