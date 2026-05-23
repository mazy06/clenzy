# Notion CRM Clenzy — Guide d'installation

Template prêt à importer pour gérer ton pipeline d'acquisition des 90 jours.

## Vue d'ensemble

3 bases liées dans une seule workspace :

1. **Prospects** — la liste des conciergeries à contacter (CSV fourni)
2. **Activités** — chaque interaction (DM, call, email)
3. **Design Partners** — les signés (vue filtrée des Prospects)

---

## Installation pas à pas

### Étape 1 — Créer la workspace Notion

1. Aller sur [notion.so](https://notion.so), créer un compte gratuit (suffit largement)
2. Créer une nouvelle page : `Clenzy Sales CRM`
3. À l'intérieur, créer une sous-page : `1. Prospects`

### Étape 2 — Importer la base Prospects

1. Dans la page `1. Prospects`, taper `/database` → choisir `Database — Inline`
2. Une fois la base créée, cliquer sur `...` (trois points en haut à droite) → `Merge with CSV`
3. Sélectionner le fichier `notion-crm-template.csv` fourni
4. Vérifier que les colonnes sont bien mappées (notamment les dates)

### Étape 3 — Configurer les types de colonnes

Une fois importé, ajuster les types via le menu `Edit property` :

| Colonne | Type Notion | Options / Format |
|---------|-------------|------------------|
| Nom | Title | — |
| Entreprise | Text | — |
| Ville | Select | Paris / Nice / Lyon / Marseille / Bordeaux / Chamonix / Megève / Antibes / Marrakech / Autre |
| URL LinkedIn | URL | — |
| Site web | URL | — |
| Biens estimés | Number | Format : Number |
| Téléphone | Phone | — |
| Email | Email | — |
| Statut | Status | À contacter → Connection envoyée → Acceptée → DM envoyé → Répondu → Call booké → Démo effectuée → Trial actif → Design Partner → Client payant → Perdu |
| Score chaleur | Select | 1 ⚪ / 2 🟡 / 3 🟠 / 4 🔴 / 5 🟢 (1 = froid, 5 = très chaud) |
| Source | Select | Sales Nav / Groupe FB / Réseau / Cold Outreach / LinkedIn outbound / Référé / Inbound site |
| Date connection request | Date | — |
| Date acceptation | Date | — |
| Date premier DM | Date | — |
| Date réponse | Date | — |
| Date call booké | Date | — |
| Date call effectué | Date | — |
| Date trial démarré | Date | — |
| Date design partner signé | Date | — |
| Date 1er paiement | Date | — |
| Logiciel actuel | Select | Smoobu / Hostaway / iGMS / Beds24 / Hospitable / Lodgify / Avantio / Bookiply / Excel / Aucun / Autre |
| Douleurs identifiées | Multi-select | Reversements / Sync calendriers / Double bookings / Pricing dynamique / Facturation NF / Ménage / Messaging / Multi-langues / Tarif élevé / Pas de support FR / Autre |
| Budget mensuel estimé | Select | 0-300€ / 300-700€ / 700-1500€ / 1500-3000€ / 3000€+ |
| Notes | Text | Long form |

### Étape 4 — Créer les vues

Les vues permettent de filtrer la même base de plusieurs façons. À ajouter :

#### Vue 1 — `Pipeline` (Kanban par statut)
- Type : Board
- Group by : Statut
- Sort : Score chaleur (descending), puis Date dernière interaction
- Filter : Statut ≠ "Perdu" AND Statut ≠ "Client payant"

→ Vue principale pour ton suivi quotidien

#### Vue 2 — `À contacter cette semaine` (Liste)
- Type : Table
- Filter : Statut = "À contacter"
- Sort : Score chaleur (desc)
- Limit : 50

→ Tes 50 cibles de la semaine

#### Vue 3 — `Relances DM` (Liste)
- Type : Table
- Filter : Statut = "DM envoyé" AND `Date premier DM` < `3 jours` ago
- Sort : Date premier DM (asc)

→ Qui relancer aujourd'hui (J+3)

#### Vue 4 — `Calls cette semaine` (Calendar)
- Type : Calendar
- Calendar by : `Date call booké`
- Filter : Statut = "Call booké"

→ Préparation des calls

#### Vue 5 — `Design Partners` (Liste)
- Type : Table
- Filter : Statut = "Design Partner" OR Statut = "Client payant"
- Sort : Date design partner signé (desc)

→ Ta liste clients actifs (à entretenir hebdo)

#### Vue 6 — `Funnel Stats` (Board)
- Type : Board
- Group by : Statut
- Compte : nombre par colonne

→ Vue d'ensemble du funnel (auto-calculé)

---

## Workflow quotidien

### Le matin (15 min)

1. Ouvrir vue `Relances DM` → identifier les 5-10 à relancer
2. Ouvrir vue `Calls cette semaine` → préparer les calls du jour
3. Ouvrir vue `À contacter cette semaine` → choisir les 10 prochains

### Pendant les calls (5 min après chaque)

Mettre à jour la fiche du prospect :
- Changer Statut
- Ajouter score chaleur
- Remplir Notes avec :
  - Combien de biens exactement
  - Logiciel actuel + ce qu'il en pense
  - Douleur n°1 mentionnée
  - Budget évoqué
  - Prochaine action (call retour, démo, trial)

### Le vendredi (30 min — KPI review)

Sur la page principale `Clenzy Sales CRM`, créer une section `Reporting hebdo` avec :

```
## Semaine du __ au __

- Connection requests envoyées : __
- Connections acceptées : __ (taux : __%)
- DMs envoyés (1er + relances) : __
- Réponses positives : __ (taux : __%)
- Calls bookés : __
- Calls effectués : __
- Trials démarrés : __
- Design partners signés : __

### À améliorer la semaine prochaine
- __
```

---

## Base 2 — Activités (optionnel mais recommandé)

Pour tracker chaque interaction (DM, call, email) :

1. Créer une nouvelle base : `2. Activités`
2. Colonnes :

| Colonne | Type | Détails |
|---------|------|---------|
| Date | Date | — |
| Type | Select | Connection request / DM 1er / DM relance / Call / Email / Visio démo |
| Prospect | Relation | → Base `Prospects` |
| Canal | Select | LinkedIn / Email / WhatsApp / Téléphone / Visio |
| Notes | Text | Contenu de l'échange |
| Outcome | Select | Positif / Neutre / Négatif / À relancer |

3. Vue `Activités par prospect` (group by Prospect) → historique complet

---

## Base 3 — Design Partners (optionnel)

Pour les onboardés, créer une vue détaillée avec :

| Colonne | Type | Notes |
|---------|------|-------|
| Nom | Title | Lié à Prospect |
| Date signature | Date | — |
| Biens migrés | Number | Combien de biens connectés à Clenzy |
| Propriétaires gérés | Number | — |
| Dernier call hebdo | Date | À mettre à jour |
| NPS (0-10) | Number | Demandé chaque mois |
| Témoignage écrit | Checkbox | Publié sur le blog |
| Vidéo témoignage | Checkbox | Tournée |
| Engagement payant prévu | Date | M+7 par défaut |
| Tickets ouverts | Number | Bugs / demandes en cours |

---

## Tips opérationnels

### Tip 1 — Couleurs des statuts

Configure les couleurs du Status pour repérer en un coup d'œil :
- À contacter → Gris
- Connection envoyée → Bleu clair
- Acceptée → Bleu
- DM envoyé → Jaune
- Répondu → Orange
- Call booké → Rouge clair (action !)
- Démo effectuée → Violet
- Trial actif → Vert clair
- Design Partner → Vert
- Client payant → Vert foncé
- Perdu → Gris foncé

### Tip 2 — Templates de pages

Crée une page-template pour chaque nouveau Design Partner avec :
- Notes d'onboarding
- Compte-rendu calls hebdo
- Bugs remontés
- Demandes features

Dans la base `Prospects` → bouton `New` → menu `Templates` → ajouter.

### Tip 3 — Synchronisation Google Calendar

Pour les calls bookés via Calendly, activer la synchro :
1. Notion → Settings → Integrations → Google Calendar
2. Lier ton calendrier
3. Les calls Calendly apparaissent automatiquement dans Notion

### Tip 4 — Mobile

L'app Notion mobile fonctionne bien. Garde la vue `Pipeline` en favori pour les updates rapides après un call dans la rue.

---

## Évolution future

Quand tu atteins 50+ prospects actifs, considérer migrer vers :

- **Pipedrive** (~15€/mois) — pipeline visuel plus puissant
- **HubSpot CRM Free** — gratuit jusqu'à 1M contacts, plus complet
- **Folk** (~25€/mois) — moderne, focus B2B FR

Mais ne migrer **pas avant** d'avoir 50 prospects actifs minimum. Notion suffit largement aux 90 premiers jours.

---

## En résumé

Tu as 3 fichiers à utiliser :

1. **`notion-crm-template.csv`** — à importer dans Notion (10 exemples de prospects pour démarrer)
2. **`notion-crm-setup.md`** (ce document) — instructions complètes
3. **Workflow quotidien** ci-dessus — à coller dans une page Notion comme rappel

Temps total d'installation : 30-45 minutes pour avoir un CRM opérationnel.
