# Handoff — Service SSR « Baitly Sites » + Cloudflare for SaaS (P1.1 c/d)

> Cadrage de l'étape **infra** de P1.1 : ce qui reste après le backend in-repo (livré : entités
> `Site`/`SitePage`/`SiteDomain`/`BlogPost`, CRUD admin, **contrat REST de livraison**, sitemap).
> Décisions verrouillées : **D-1 Next.js dédié** · **D-2 Cloudflare for SaaS** (cf. REFONTE-BOOKING-ENGINE.md §H).
> Dernière MAJ : 2026-06-15.

---

## 0. Répartition des responsabilités

| Lot | Quoi | Qui | Repo |
|---|---|---|---|
| **Backend in-repo** | Modèles + CRUD + **contrat REST** + sitemap | ✅ FAIT | `clenzy` |
| **Bridge Cloudflare** | Appel Custom Hostnames API à l'ajout de domaine + réconciliation statut | ⬜ in-repo (je peux faire) — **nécessite un token CF (secret)** | `clenzy` |
| **Service Next.js** | App SSR/ISR « Baitly Sites » consommant le contrat REST | ⬜ **nouveau repo/app** | `clenzy-sites` (nouveau) |
| **Cloudflare for SaaS** | Zone `clenzy.site`, wildcard, fallback origin, plan SaaS | ⬜ **toi** (compte/console CF) | — |
| **Déploiement** | docker-compose + reverse-proxy + CD | ⬜ **toi** (+ je peux préparer les fichiers) | `clenzy-infra` |

---

## 1. Architecture cible

```
Voyageur
  │  https://{slug}.clenzy.site   ou   https://reservation.monhotel.com
  ▼
Cloudflare (TLS auto via for SaaS / wildcard)  ──►  Fallback origin (clenzy-infra)
  │                                                   nginx → service Next.js « Baitly Sites »
  ▼
Next.js (SSR/ISR)
  │  1) middleware lit l'Host → GET /api/public/sites/resolve?hostname=<host>
  │  2) page → GET /api/public/sites/{id}/page?path=&locale=  (+ /posts, /sitemap)
  │  3) données dynamiques → endpoints publics existants (/api/public/booking/...)
  ▼
clenzy (Spring) — contrat REST déjà livré  ──►  PostgreSQL (sites/site_pages/site_domains/blog_posts)
```

Le **moteur de données reste Spring** ; Next.js ne fait que **résoudre + rendre**. Le widget de
réservation embarqué dans les pages réutilise le SDK existant (`BaitlyWidget`) en mode client.

---

## 2. Contrat REST déjà livré (consommé par le SSR)

Base : `${CLENZY_API_BASE_URL}` (URL interne du backend, ex. `http://pms-server:8084`).

| Méthode | Endpoint | Usage SSR |
|---|---|---|
| GET | `/api/public/sites/resolve?hostname=` | Résolution hostname → `SitePublicDto` (id, slug, thème, locales, SEO defaults, `bookingEngineConfigId`, table des pages). 404 si introuvable/non publié. |
| GET | `/api/public/sites/{id}/page?path=&locale=` | `SitePagePublicDto` (blocs JSON + SEO). Repli locale → page commune. |
| GET | `/api/public/sites/{id}/posts` | `BlogPostSummaryDto[]` (index blog / RSS). |
| GET | `/api/public/sites/{id}/posts/by-slug?slug=&locale=` | `BlogPostPublicDto` (corps complet + SEO). |
| GET | `/api/public/sites/{id}/sitemap` | `SitemapEntryDto[]` (pages + articles ; le SSR ajoute les URLs propriétés + compose le XML). |
| GET | `/api/public/booking/{slug}/properties` … | Données dynamiques (liste/détail propriétés, dispo, prix) — endpoints existants. |

> `resolve` ne renvoie que des sites **PUBLISHED** ; les pages/articles **DRAFT** sont invisibles côté public.

---

## 3. Service Next.js « Baitly Sites » (nouveau repo `clenzy-sites`)

### 3.1 Structure (App Router, Next 14+)
```
clenzy-sites/
  middleware.ts                 # résout l'Host → siteId (cache court), injecte en header
  app/
    layout.tsx                  # <html lang> + thème (CSS vars depuis designTokens)
    [[...path]]/page.tsx        # page composée : resolve + getPage → rend les blocs (SSR/ISR)
    blog/page.tsx               # index blog
    blog/[slug]/page.tsx        # article (schema Article)
    sitemap.xml/route.ts        # GET sitemap → XML (pages + posts + propriétés)
    robots.txt/route.ts
    rss.xml/route.ts            # flux blog
  lib/
    api.ts                      # fetch typé du contrat REST (revalidate ISR)
    blocks.tsx                  # registre de rendu des blocs (miroir du Studio)
    seo.ts                      # meta/OG + JSON-LD (LodgingBusiness/Offer/Article/AggregateRating)
```

### 3.2 Résolution par hostname (middleware)
```ts
// middleware.ts
export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const res = await fetch(`${process.env.CLENZY_API_BASE_URL}/api/public/sites/resolve?hostname=${host}`,
    { next: { revalidate: 60 } });
  if (!res.ok) return new NextResponse('Site introuvable', { status: 404 });
  const site = await res.json();
  const headers = new Headers(req.headers);
  headers.set('x-site-id', String(site.id));
  headers.set('x-site-locale', site.defaultLocale);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
```

### 3.3 Rendu de page (ISR)
```ts
// app/[[...path]]/page.tsx
export const revalidate = 300; // ISR 5 min ; invalidation on-publish via revalidateTag possible
export default async function Page({ params }) {
  const siteId = headers().get('x-site-id');
  const path = '/' + (params.path?.join('/') ?? '');
  const page = await getPage(siteId, path, locale);   // 404 → notFound()
  return <BlockRenderer blocks={JSON.parse(page.blocks)} />;
}
export async function generateMetadata(...) { /* seo.ts : title/desc/OG/canonical/hreflang */ }
```

### 3.4 Points clés
- **Réutiliser le registre de blocs** du front (`blockRegistry`/`blockStyles.css` + `selectorCatalog`) — extraire en package partagé ou copier le rendu (les blocs sont déjà des fonctions pures `props → JSX`).
- **Widget de réservation** : monter `BaitlyWidget` en client component (`'use client'`) avec l'`apiKey` du `bookingEngineConfigId` du site.
- **hreflang** : générer depuis `site.locales` (CSV) ; une URL par locale.
- **JSON-LD** : `LodgingBusiness` (org/propriété), `Offer` (prix/dispo via `/availability`), `AggregateRating` (via `/reviews`), `Article` (blog), `BreadcrumbList`.
- **CSS custom** : injecter `customCss` (déjà géré côté page publique React) au `<head>` SSR.
- **Sécurité** : fetch **server-side only** vers l'API interne (jamais exposer l'URL interne au client) ; échapper tout contenu user rendu hors blocs ; rate-limit au edge.

### 3.5 Variables d'env
```
CLENZY_API_BASE_URL=http://pms-server:8084     # URL interne backend (réseau docker)
CLENZY_SITES_BASE_DOMAIN=clenzy.site           # suffixe sous-domaines
NEXT_PUBLIC_WIDGET_BASE_URL=https://app.clenzy.fr   # base API publique pour le widget client
```

---

## 4. Cloudflare for SaaS (console — toi)

### 4.1 Pré-requis
1. Zone **`clenzy.site`** sur Cloudflare (achat domaine si pas déjà fait).
2. Plan permettant **Cloudflare for SaaS** (Custom Hostnames) — payant au-delà du quota inclus.
3. **Fallback origin** : un hostname (ex. `ssr-origin.clenzy.fr` ou IP) pointant vers le reverse-proxy `clenzy-infra` qui sert le service Next.js. Configuré une fois dans for SaaS.

### 4.2 Sous-domaines `*.clenzy.site`
- Enregistrement **wildcard** `*.clenzy.site` (proxied) + **cert wildcard** → tout `{slug}.clenzy.site` est servi + TLS immédiat, **sans action par site**. (`SiteDomain` status `ACTIVE` d'emblée pour les sous-domaines — ou pas de ligne `SiteDomain` du tout, le sous-domaine étant dérivé du `slug`.)

### 4.3 Domaines custom (`reservation.monhotel.com`)
Flux par domaine ajouté côté admin (`POST /api/sites/{id}/domains`) :
1. Backend appelle **Custom Hostnames API** : `POST /zones/{zone}/custom_hostnames` `{hostname, ssl:{method:'http'|'txt'}}` → renvoie un `id` + les enregistrements de validation.
2. Stocker l'`id` dans **`site_domains.cloudflare_hostname_id`** (champ déjà prévu), status `PENDING`.
3. Le client (hôte) crée un **CNAME** `reservation.monhotel.com → {slug}.clenzy.site` (ou la cible fallback) — à afficher dans l'UI admin.
4. Cloudflare valide + émet le TLS → réconcilier : passer `site_domains.status = ACTIVE` + `verified = true` (poll périodique `GET /custom_hostnames/{id}` ou webhook).

> Le contrat de livraison `resolve` ne sert un domaine custom **que si `status = ACTIVE`** (déjà codé).

---

## 5. Bridge Cloudflare in-repo (⬜ je peux le faire — besoin d'un token CF)

À construire dans `clenzy` quand le compte CF + token sont prêts (secret `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID`) :

- `CloudflareCustomHostnameService` (intégration, hors-tx + idempotency, audit #2) :
  - `create(hostname)` → POST API → retourne `hostnameId` + DNS/TLS records.
  - `status(hostnameId)` → GET API → mappe vers `SiteDomainStatus`.
  - `delete(hostnameId)`.
- Brancher dans `SiteAdminService.addDomain` : après save PENDING, **afterCommit** appeler `create(...)` → stocker `cloudflareHostnameId`. (Aujourd'hui `addDomain` se contente de PENDING — le champ est prêt.)
- `SiteDomainReconcileScheduler` : pour les domaines `PENDING` avec `cloudflareHostnameId`, poller le statut CF → `ACTIVE`/`FAILED`.
- Endpoint admin `GET /api/sites/{id}/domains/{domainId}/dns` → renvoie les enregistrements CNAME/TXT à afficher au client.

> **Pas de secret CF dans le code** (audit #12) : token via env, fail-fast au boot en prod si la feature domaines custom est activée sans token.

---

## 6. Déploiement clenzy-infra (⬜ toi — je peux préparer les fichiers)

- Service docker-compose `clenzy-sites` (image Next.js, `CLENZY_API_BASE_URL` réseau interne).
- Reverse-proxy nginx : router le **fallback origin** + `*.clenzy.site` + custom hostnames → `clenzy-sites`.
- CD : build/push de l'image + déploiement (mêmes patterns que `pms-server`/`clenzy-frontend`).
- CSP/headers : autoriser le widget (déjà géré pour `app.clenzy.fr` ; adapter pour les domaines de sites).

---

## 7. Plan d'exécution (ordre conseillé)

1. **Toi** : zone `clenzy.site` + wildcard + plan for SaaS + fallback origin.
2. **Moi (in-repo)** : `CloudflareCustomHostnameService` + bridge `addDomain` + scheduler de réconciliation (dès token CF dispo).
3. **Repo `clenzy-sites`** : scaffold Next.js (middleware resolve + rendu blocs + ISR) → MVP sous-domaines `{slug}.clenzy.site`.
4. **SEO/Blog SSR** (1.2/1.3 reste) : meta/JSON-LD/hreflang/canonical/robots + `sitemap.xml` (à partir de `/sitemap` + propriétés) + RSS.
5. **Domaines custom** : activer le flux CF de bout en bout.
6. **clenzy-infra** : compose + nginx + CD.

## 8. Quick wins de validation (sans Cloudflare)
- Le service Next.js peut tourner en local en pointant `CLENZY_API_BASE_URL` sur le backend dev et en résolvant un site via `?hostname={slug}.clenzy.site` (forçable) → valide tout le rendu **avant** l'infra TLS/domaines.
- Créer un `Site` PUBLISHED + une `SitePage(HOME, PUBLISHED)` via `/api/sites` pour avoir un cas de test.
