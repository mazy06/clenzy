# Guide de test — Booking Engine / Baitly Studio (campagne P2 2026-06-15)

> Valide le gros lot de travail booking-engine (P2). **À jouer après rebuild** : les migrations
> **0252→0262** s'appliquent au boot (Liquibase) et de nouveaux endpoints apparaissent.

## 0. Pré-requis — rebuild

```bash
# clenzy-infra
./start-dev.sh        # rebuild pms-server (migrations 0252→0262 au boot) + pms-client (HMR)
docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f pms-server   # vérifier le boot
```

- **Boot OK** = log Liquibase « Update ... successful » jusqu'à `0262`, puis `Started ClenzyApplication`.
- Si crash `relation "xxx" does not exist` → un changeset 0252→0262 a un mauvais nom de table (cf. CLAUDE.md).
- SSR `clenzy-sites` (optionnel) : repo séparé, builder/déployer à part pour tester le rendu public des sites.

## 1. Studio — composition de page (2.2 / 2.3 / 2.4 / 2.1 / 2.5 / 2.7)

Aller dans **Booking Engine → Studio → éditer un booking engine → onglet Design**.

| # | Test | Attendu |
|---|---|---|
| 2.2 | Barre de pages : **Ajouter**, renommer (double-clic), **réordonner ◂▸**, supprimer | Pages persistées ; accueil épinglée ; auto-save au changement de page. *(Nécessite l'endpoint `POST /api/sites/ensure-for-config/{id}` → sinon repli mono-page propre.)* |
| 2.2 | Onglet **Page** : titre / chemin / statut / SEO | Persistés au blur |
| 2.3 | Ajouter les blocs **FAQ, Galerie, Chiffres clés, Vidéo, Carte, Table de prix, Logos** | Rendus dans le canvas + aperçu |
| 2.4 | Sur un bloc : **alignement**, **couleur de fond**, **image de fond** | Reflétés en direct |
| 2.1 | Champ image (hero « image de fond ») → bouton **médiathèque** → **importer** une image (≤5 Mo) → la choisir | L'image s'affiche (URL `/api/public/media/{id}` absolue) |
| 2.5 | Sur un bloc : **Masquer sur mobile/tablette/desktop** + bascule l'aperçu desktop/tablette/mobile | Le bloc disparaît au bon breakpoint (container queries) |
| 2.7 | **Glisser-déposer** un bloc dans l'arbre (poignée ⠿) ; **Annuler/Rétablir** (toolbar) | Réordonne ; undo/redo restaurent l'état |

## 2. Conversion / revenu

| # | Test | Attendu |
|---|---|---|
| 2.8 | Réglages → **Réservation directe** : remise % (ex. 10). Côté widget, faire un devis | Récap montre le tarif plein + ligne **« Réservation directe −X »** ; total remisé |
| 2.9 | Widget : cartes de propriétés (avec des réservations/dispo réelles) | Badges **« Réservé N× »** (si ≥3) / **« Plus que N dates en 30 j »** (si ≤8) |
| 2.10 | `UpsellsAdmin` : créer une offre avec **séjour min**, **délai mini**, ou un **bundle** (multiselect d'offres) | Le livret guest n'affiche l'offre que si les conditions de la résa sont remplies |
| 2.11 | Widget avec `organizationId` : **cœur** sur chaque carte → clic ouvre le **modal login/inscription** → après connexion, le cœur se remplit ; favoris persistés (rechargement = état conservé via `GET /wishlist`) | Sans `organizationId`, aucun cœur (compte voyageur désactivé). Token guest **en mémoire** (jamais localStorage) |
| 2.12 | Widget : provoquer l'**exit-intent** (souris vers le haut, hors viewport) | Modal de capture d'email (1×/session, consentement requis) → `POST /leads` |
| 2.12 | Réglages marketing (Brevo) : renseigner la **liste Leads** + activer le toggle | Les leads captés sont poussés dans la liste Brevo avec l'attribut `SOURCE` |

## 3. IA / SEO (2.13)

- Studio → onglet **Page** → bouton **« Générer (IA) »** : remplit titre + meta SEO depuis le contenu de la page (nécessite la feature IA `CONTENT` activée + budget/clé).

## 4. Endpoints (curl)

```bash
API=http://localhost:8084
KEY=<clé-API-du-booking-engine>   # X-Booking-Key

# Médiathèque (admin, JWT requis) — lister
curl -s "$API/api/booking-engine/media" -H "Authorization: Bearer <JWT_PMS>"

# Quote avec remise directe (2.8) — directDiscount dans la réponse
curl -s -X POST "$API/api/public/booking/widget/availability" -H "X-Booking-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":<id>,"checkIn":"2026-07-01","checkOut":"2026-07-04","guests":2}'

# Wishlist guest (2.11) — token guest validé via Keycloak userinfo
TOKEN=<access_token_guest>   # via POST /api/booking-engine/auth/login
curl -s "$API/api/public/guest/wishlist?organizationId=<orgId>" -H "Authorization: Bearer $TOKEN"
curl -s -X POST "$API/api/public/guest/wishlist" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"organizationId":<orgId>,"propertyId":<id>}'
```

## 5. Limites connues (NON bloquantes)

- **2.11 wishlist** : UI livrée (cœurs + modal login/inscription dans le widget vanilla) — voir test 2.11. Prérequis : passer `organizationId` à l'init du widget ; le realm guest `clenzy-guests` doit accepter le login/register. Le **rate membre / wallet** (réservé aux connectés) reste Phase 2.
- **2.8 / paiement** : la remise est appliquée côté serveur ; **vérifier en Stripe test-mode** le montant réellement facturé (caution/acompte/solde inclus).
- **Phase 2 non faites** : 2.8 wallet/rate membre · 2.10 affichage « Inclus » bundle côté guest · 2.5 overrides de valeurs par breakpoint · 2.7 conteneurs lignes/colonnes · 2.13 blog IA + RAG.
- **SSR `clenzy-sites`** : repo séparé (sans git) — à committer/déployer pour tester le rendu public multi-page.
