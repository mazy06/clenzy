# Base de connaissances Baitly — templates de référence

Jeu de documents `.md` par défaut à **ingérer dans la base de connaissances (RAG)** pour ancrer les réponses du concierge IA et de l'assistant. Une fois ingérés, le concierge (`suggestReply`) et l'assistant récupèrent automatiquement les extraits pertinents à chaque message.

## Comment les utiliser

1. **Prérequis** : un modèle d'**embeddings** doit être configuré (Réglages › IA) — Voyage (`voyage-3-lite`) ou OpenAI (`text-embedding-3-small`) + la clé. Sans ça, l'ingestion échoue.
2. **Copiez** le template voulu, **remplacez tous les `{{PLACEHOLDER}}`** par vos vraies valeurs, adaptez les exemples.
3. **Supprimez la 1ʳᵉ ligne `> Modèle …`** (guide, à ne pas ingérer).
4. **Ingérez** : Réglages › IA (upload), ou `POST /api/admin/kb/ingest` (multipart, un fichier). Ré-ingérer le même nom de fichier = mise à jour (idempotent).
5. **Portée** : org-scopée par défaut (vos docs). Un doc par thème (ou par logement si le contenu diffère).

## Conventions

- **Structure en `##`** : le découpage respecte les titres de niveau 2 puis re-découpe à ~500 tokens. Gardez des sections claires et autonomes.
- **Placeholders** : `{{NOM_DU_CHAMP}}` — à remplacer avant ingestion.
- **Langue** : rédigez dans la langue de vos voyageurs (le concierge traduit au besoin, mais un contenu source clair aide).

## ⚠️ Ne PAS mettre dans la KB

- **Secrets rotatifs** : codes d'accès, mot de passe WiFi actuel, codes de boîte à clés. Ils sont **déjà gérés dynamiquement** (variables de message : `accessCode`, `wifiName`, `wifiPassword`) et changent trop souvent pour une KB. Mettez plutôt la **procédure** (« le code vous est envoyé à J-1 par message »).
- **Données personnelles** de voyageurs.
- Les **infos logement structurées** (adresse, équipements de base) sont **auto-ingérées** depuis vos fiches propriété — inutile de les dupliquer.

## Contenu (16 templates)

### Voyageur (concierge) — `guest/`
| Fichier | Objet |
|---|---|
| `01-arrivee-et-checkin.md` | Arrivée, accès, stationnement, bagagerie |
| `02-depart-et-checkout.md` | Départ, remise des clés, checklist |
| `03-wifi-et-connexion.md` | WiFi, TV, connectivité (procédure) |
| `04-reglement-interieur.md` | Règles de la maison |
| `05-equipements-et-electromenager.md` | Mode d'emploi appareils, chauffage/clim |
| `06-quartier-et-recommandations.md` | Restos, courses, sorties, à voir |
| `07-transports-et-acces.md` | Aéroport, transports, parking, mobilité |
| `08-urgences-et-securite.md` | Contacts, coupures, sécurité, santé |
| `09-dechets-et-recyclage.md` | Poubelles, tri, jours de collecte |
| `10-faq-voyageurs.md` | Questions fréquentes |
| `11-services-et-options.md` | Options payantes (late checkout, nuit sup…) |
| `12-politiques.md` | Animaux, fumeurs, fêtes, caution |

### Exploitation (assistant / équipe) — `ops/`
| Fichier | Objet |
|---|---|
| `13-procedure-menage.md` | Rotation, checklist ménage, standards |
| `14-politique-tarifaire-et-annulation.md` | Tarifs, remboursements, no-show |
| `15-concierge-consignes-et-ton.md` | Ton de voix + règles d'escalade du concierge IA |
