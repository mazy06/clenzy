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
| 3A | **P8** `DocumentType.DEVIS_MENAGE` (décomposition moteur → propriétaire, informatif). | ⬜ |
| 3B | **P9** payout Stripe Connect du pro à la complétion, **gaté par checklist photo** (VALIDATION_FIN_MISSION déclencheur). | ⬜ |
| 3C | **P10** anomalie terrain → entité `Issue` → devis maintenance chiffré → notif host (fusion initiative B4). | ⬜ |
| 3D | Auto-assignation dispo+tarif+score · score qualité (pass-rate photos 30 j) · majorations saisonnières/add-ons. | ⬜ |

## Différés

- **P6** templates WhatsApp terrain (Meta UTILITY) — si demande des pros.
- **P7** préférence de canal par utilisateur — YAGNI tant que push+email suffisent.
- Marketplace de sourcing de prestataires — hors modèle B2B conciergerie (fondations posées par le score 3D).
