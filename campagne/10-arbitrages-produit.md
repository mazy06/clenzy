# Arbitrages produit — chantiers restants (post-campagne)

> Cadrage du 2026-07-03 pour décision utilisateur. Les 4 chantiers priorisés :
> le sous-budget par forfait est FAIT (défauts grille §9 quand pas de config, behaviors
> toujours opt-in) ; restent 3 chantiers qui exigent des décisions produit AVANT le code.

## 1. Pilote pricing per-outcome (L4)

**Objectif** : facturer au résultat (« message guest résolu sans humain = 3 crédits ») plutôt
qu'aux tokens — gate décidé en campagne : ne lancer le pilote que si le taux de résolution
sans humain dépasse ~50 % (réf. Maia).

**Ce qui existe** : le numérateur — compteur `assistant.outcome.guest_auto_reply{org,status}`
sur chaque réponse automatique du chat guest (livret).

**À décider (le dénominateur — définition de « reprise humaine ») — proposition** :
une conversation guest est « reprise par un humain » si un message MANUEL (envoyé par un
membre de l'org depuis la messagerie, pas par un scheduler/template automatique) part vers le
même guest dans les **24 h** suivant une auto-réponse. Instrumentation : compteur
`assistant.outcome.manual_takeover` posé au point d'envoi manuel + corrélation par
réservation/guest. Mesurer 30 jours, puis GO/NO-GO pilote.
- Alternative plus stricte : fenêtre 4 h (reprises « à chaud » seulement).
- La grille de crédits per-outcome (combien vaut un « résolu ») ne se décide QU'APRÈS la mesure.

## 2. Services métier manquants (V2-b + L2-b)

Chaque item = un vrai service métier à construire (pas un wrapper). Coûts estimés en
sessions de travail. Proposition d'ordre par valeur/effort :

| # | Service | Ce que ça débloque | Effort | Dépendances |
|---|---|---|---|---|
| S1 | **Taxe de séjour** (calcul par commune/nuitée/personne, export) | Conformité FR concret pour les conciergeries ; specialist Conformité/Fiscalité viable | M | Barèmes communes (source à choisir : saisie org vs API DGFiP) |
| S2 | **Rate parity check** (comparer les prix affichés par canal) | Outil V2-b `check_rate_parity` + alertes de disparité | M | Lecture des prix par canal (Channex a l'info) |
| S3 | **Open/close disponibilité par canal** | Outil V2-b `open_close_channel_availability` (fermer Airbnb seul, etc.) | M | ChannelSyncService (existant) + granularité par canal |
| S4 | **Inventaire/Stocks** (linge, consommables par bien, seuils) | Specialist Stocks viable + réassort auto (règle d'automatisation) | L | Modèle de données neuf + UI housekeeper |
| S5 | **Payout provider** (virements sortants automatisés vers propriétaires) | Outil V2-b `execute_payout` — ATTENTION : argent sortant, HITL obligatoire | L | Choix provider (Stripe Connect payouts vs Wise, webhooks déjà reçus) |
| S6 | **DAC7 / registres** (export annuel plateformes) | Conformité annuelle | M | Périmètre légal à préciser |

**À décider** : lesquels, dans quel ordre. Recommandation : S1 + S2 d'abord (valeur
conciergerie immédiate, effort M), S3 ensuite, S4/S5/S6 en fonction de la demande client.

## 3. Yield rules automatiques (F8a)

**État** : modèle `YieldRules` inachevé (scheduler jamais terminé), PriceEngine 6 niveaux
opérationnel, suggestions tarifaires HITL déjà servies par le scan supervision premium.

**Proposition de cadrage v1 (prudent)** :
- **Règles déclaratives par org** (dans le moteur d'automatisation OU l'écran pricing) :
  « si occupation < X % à J-Y → baisser de Z % (borné par un PLANCHER par bien) » ;
  « si occupation > X % → hausser de Z % (borné par un PLAFOND) ».
- **Trois modes progressifs** : (1) simulation seule (rapport de ce qui AURAIT changé),
  (2) suggestion HITL (carte à appliquer), (3) auto sous bornes. Une org démarre en (1),
  monte en (3) après 2 semaines de simulation cohérente.
- Garde-fous non négociables : plancher/plafond par bien OBLIGATOIRES, jamais de changement
  > N %/jour, journal complet des ajustements (replay), kill-switch org.
- **À décider** : le principe des 3 modes, et si le v1 se limite à la baisse (risque
  principal = brader) ou couvre aussi la hausse.

## Arbitrages rendus le 2026-07-03 (utilisateur)

1. **Per-outcome** : reprise humaine = message MANUEL d'un membre de l'org vers le même guest
   dans les **24 h** après une auto-réponse. Instrumenter, mesurer 30 j, puis GO/NO-GO pilote.
2. **Services métier** : lancer **S1 taxe de séjour + S2 rate parity + S3 open/close par canal** ;
   S4 stocks / S5 payouts sortants / S6 DAC7 reportés à la demande client.
3. **Yield v1** : cadrage validé — 3 modes progressifs (simulation → suggestion HITL → auto borné),
   **baisse ET hausse** couvertes, planchers/plafonds par bien obligatoires, max N %/jour,
   journal complet, kill-switch org.

## Décisions prises le 2026-07-03

- Sous-budget autonomie par forfait : **FAIT** (défauts 0/500/2 500 selon forfait quand pas
  de config explicite ; behaviors opt-in inchangés).
- Déploiement : PR #317 mergée par l'utilisateur — prod à jour du lot campagne.
- `ddl-auto=validate` en dev : reporté en chantier infra dédié (hotfix prod en cours sur
  clenzy-infra, et `validate` bloque le boot en cas de dérive résiduelle).
