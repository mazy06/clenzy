# Meta App Review — Clenzy WhatsApp Embedded Signup

> **Objectif** : permettre aux hosts Clenzy de connecter leur numéro WhatsApp Business en 1 clic via le flow Embedded Signup (au lieu de 1-3 jours de setup manuel Meta Business Manager).
>
> **Délai prévu** : 1-2 semaines de review Meta après soumission.

---

## Pourquoi cette review

Pour utiliser l'**[Embedded Signup Flow](https://developers.facebook.com/docs/whatsapp/embedded-signup)**, Clenzy doit obtenir l'approbation Meta pour 3 permissions clés sur sa Meta App :

| Permission | Usage Clenzy |
|---|---|
| `whatsapp_business_management` | Récupérer les WABA + phone numbers du host après signup |
| `whatsapp_business_messaging` | Envoyer/recevoir des messages au nom du host (System User Token) |
| `business_management` | Lire les Business Accounts pour matcher le WABA au phone number |

Sans ces permissions, on reste sur le form manuel actuel (apiToken/phoneNumberId/businessAccountId saisis à la main).

---

## Checklist pré-soumission

- [ ] **1. Créer une Meta App** sur https://developers.facebook.com/apps
  - Type : `Business`
  - Nom : `Clenzy PMS`
  - Catégorie : `Business and Pages`
- [ ] **2. Ajouter le produit WhatsApp** dans la Meta App
  - Plus tard configurer l'Embedded Signup Configuration ID
- [ ] **3. Renseigner les infos requises** :
  - URL privacy policy : `https://clenzy.fr/confidentialite`
  - URL ToS : `https://clenzy.fr/cgu`
  - Email de contact : `support@clenzy.fr`
  - App icon : 1024×1024 PNG (logo Clenzy mark sur fond brand)
- [ ] **4. Configurer un System User** dans le Meta Business Manager de Clenzy
  - Rôle : Admin
  - Génère un System User Token (long-lived) pour les calls server-to-server
- [ ] **5. Préparer les artifacts de review** (cf. fichiers ci-dessous)
- [ ] **6. Soumettre la review** via App Dashboard → App Review → Permissions and Features
- [ ] **7. Répondre aux questions de Meta** (~2-5 jours après soumission)
- [ ] **8. Activer l'App en Live mode** une fois approuvé

---

## Fichiers de cette doc

| Fichier | Pour quoi |
|---|---|
| [`use-case.md`](./use-case.md) | Description détaillée du use case Clenzy à envoyer à Meta lors de la review |
| [`screencast-script.md`](./screencast-script.md) | Script + scénario pour la vidéo screencast à fournir avec la review (3-5 min) |
| [`privacy-policy-updates.md`](./privacy-policy-updates.md) | Sections à ajouter dans `clenzy.fr/confidentialite` pour couvrir le traitement WhatsApp |
| [`permissions-justifications.md`](./permissions-justifications.md) | Justifications par permission (à coller dans le form Meta) |
| [`embedded-signup-flow.md`](./embedded-signup-flow.md) | Doc technique du flow Embedded Signup côté Clenzy (référence dev) |

---

## Configuration Meta App requise après approval

Une fois la review passée, ajouter ces variables d'env dans `.env.dev` (et `.env` prod) :

```bash
# Meta App credentials (depuis App Dashboard > Settings > Basic)
META_APP_ID=123456789012345
META_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Embedded Signup Configuration ID (depuis App Dashboard > WhatsApp > Configurations)
META_EMBEDDED_SIGNUP_CONFIG_ID=xxxxxxxxxxxx

# System User Token (long-lived, depuis Meta Business Manager > Users > System Users)
META_SYSTEM_USER_TOKEN=EAAxxxxxxxxxxxxxx
```

Le pms-server les utilise pour échanger les codes OAuth et provisionner les WABAs.

---

## Coût et marge

Une fois Tech Provider Meta :
- **Coût Clenzy** : 0€ (gratuit, hors infra pms-server)
- **Coût host** : facturation conversation-based standard Meta (~$0.014-$0.07/conv) — payé directement par Clenzy via le System User Token, refacturé au host dans son plan Clenzy
- **Marge** : ~30-50% sur les conversations vs revente Twilio (qui prend la même marge en intermédiaire)

---

## Risques

- **Risque #1** : Meta refuse la review (use case mal expliqué) — mitigation : screencast clair + use-case.md détaillé
- **Risque #2** : Review prend > 2 semaines — mitigation : OpenWA reste activable en fallback pour les hosts qui veulent commencer tout de suite (provider strategy déjà en place)
- **Risque #3** : Meta révoque les permissions plus tard — mitigation : monitoring du status App + alerte si dégradation

---

## Liens utiles

- Embedded Signup Docs : https://developers.facebook.com/docs/whatsapp/embedded-signup
- App Review Guidelines : https://developers.facebook.com/docs/app-review
- WhatsApp Business Platform : https://business.whatsapp.com/products/business-platform
- Tech Provider Program : https://www.facebook.com/business/m/whatsapp/business-solution-providers
