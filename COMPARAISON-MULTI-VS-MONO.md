# Protocole de comparaison — Assistant multi-agent vs mono-agent

But : décider si on garde le multi-agent (défaut `clenzy.assistant.multi-agent.enabled=true`)
ou si on revient au mono-agent, sur la base du **coût réel** (tokens facturés) + de la **qualité**.

> Prérequis : le fix de label modèle + le lot de correctifs sont buildés → **rebuild `pms-server`**
> avant de commencer, sinon les labels/coûts seront encore faux.

---

## 0. Conditions identiques (à figer pour les 2 runs)

- **Feature Assistant** = même provider + même modèle (aujourd'hui : OpenAI · `gpt-5.4-mini`).
- **Même logement supervisé** sélectionné (parité pour la carte HITL ménage impayé).
- **Une conversation NEUVE par prompt** (bouton nouvelle conversation) — évite que l'historique
  d'un prompt fausse le suivant. Même règle dans les 2 modes.
- Faire les 2 runs **le même jour**, idéalement **à quelques minutes d'intervalle** (cache OpenAI
  comparable). On mesure par **delta** sur les totaux, donc peu importe les anciennes données.

## 1. Jeu de prompts figé (identique dans les 2 modes)

| # | Intention | Prompt |
|---|---|---|
| P1 | Finance | « Fais-moi le bilan financier du mois. » |
| P2 | Réservations | « Quelles réservations arrivent cette semaine ? » |
| P3 | Impayé (HITL) | « Ai-je des ménages non réglés sur ce logement ? » *(si carte → même choix dans les 2 modes : confirmer ou refuser, mais identique)* |
| P4 | Pricing | « Recommande-moi un ajustement de prix pour le week-end prochain. » |
| P5 | Analytics | « Analyse la performance de mon portefeuille. » |
| P6 | Multi-domaine | « Fais le bilan financier et bloque le calendrier du 10 au 12. » |
| P7 | Suivi / contexte | *(dans la MÊME conversation que P2)* « Et le mois prochain ? » |
| P8 | Simple / navigation | « Où puis-je configurer mes tarifs ? » |

> P6 (multi-domaine) et P7 (suivi) sont les cas où multi-agent et mono divergent le plus.

## 2. Mesure (vue Paramètres > IA > Consommation)

Avant chaque run, note les totaux ; après, re-note et fais la **différence**.
Bascule le toggle **Cost** pour lire le coût.

- **Total tokens** (delta) et **Total cost** (delta) sur la période.
- Par prompt, note dans le tableau §4 : réponse OK ? latence ressentie, erreur/« reformule »,
  carte HITL apparue ?

## 3. Déroulé

### Run A — MULTI-AGENT (`enabled=true`, défaut actuel)
1. `pms-server` rebuild à jour, toggle sur multi-agent.
2. Consommation : note `Total tokens A0`, `Total cost A0`.
3. Envoie P1→P8 (P7 dans la conversation de P2), une conversation neuve par prompt sinon.
4. Note `Total tokens A1`, `Total cost A1`. → **ΔA = A1 − A0**.

### Run B — MONO-AGENT (`enabled=false`)
1. Passe `clenzy.assistant.multi-agent.enabled=false` (env du conteneur `pms-server`) → **redémarre `pms-server`**.
2. Consommation : note `Total tokens B0`, `Total cost B0`.
3. Envoie **exactement** les mêmes P1→P8, même façon.
4. Note `Total tokens B1`, `Total cost B1`. → **ΔB = B1 − B0**.

## 4. Grille de résultats

| Prompt | Mode | Réponse correcte ? | Carte HITL ? | Erreur/reformule ? | Latence ressentie |
|---|---|---|---|---|---|
| P1 | Multi / Mono | | | | |
| P2 | Multi / Mono | | | | |
| P3 | Multi / Mono | | | | |
| P4 | Multi / Mono | | | | |
| P5 | Multi / Mono | | | | |
| P6 | Multi / Mono | | | | |
| P7 | Multi / Mono | | | | |
| P8 | Multi / Mono | | | | |

| Métrique globale | Multi (ΔA) | Mono (ΔB) |
|---|---|---|
| Total tokens | | |
| Coût total ($) | | |
| Nb d'appels *(indicatif)* | | |

## 5. Décision

- **Coût** : ΔB (mono) attendu ≤ ΔA (multi) — le mono scopé (#1) évite l'appel orchestrateur
  + la répétition historique/RAG par specialist. Si l'écart est faible, la qualité tranche.
- **Qualité** : le multi peut mieux gérer P6 (multi-domaine) ; le mono peut suffire partout.
- **Règle de décision** : garder multi-agent **seulement si** son gain qualité (P6/P7 nettement
  meilleurs) justifie le surcoût tokens. Sinon → `enabled=false` (retour mono, une ligne).

## Pièges à éviter

- Ne pas comparer aux **anciens** enregistrements (labels faux d'avant le fit) — uniquement les deltas.
- Cache OpenAI (TTL ~5–10 min) : faire les 2 runs rapprochés pour un cache comparable.
- Même **choix HITL** (confirmer/refuser) sur P3 dans les 2 modes, sinon le nb de tours diffère.
- Ne pas changer de modèle entre les runs.
