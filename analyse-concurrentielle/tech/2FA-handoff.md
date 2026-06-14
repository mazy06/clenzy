# 2FA (CLZ-P0-09) — Handoff d'activation (realm Keycloak + wiring)

> Ce document décrit ce qui reste à faire pour **activer réellement** la 2FA, au-delà de la
> partie applicative déjà livrée. Deux zones sont volontairement **non modifiées sans revue
> explicite** : le repo `clenzy-infra` (realm Keycloak) et `SecurityConfigProd.java`
> (fichier sensible). À exécuter comme **étape coordonnée**.

## 1. Déjà livré (côté app, ce repo)
- `Organization.mfaRequired` (policy par org) + migration `0238__add_mfa_required_to_organizations.sql`.
- `service/access/MfaPolicyEvaluator.java` — décision pure : à partir des claims `amr`/`acr` du JWT + de la policy org, dit si l'accès satisfait la 2FA. **Testé** (`MfaPolicyEvaluatorTest`, 7 cas).
- ⚠️ **Non câblé** dans la chaîne de sécurité (volontaire — voir §3) et **pas d'enrôlement TOTP** (c'est Keycloak — voir §2).

## 2. À faire dans `clenzy-infra` (realm Keycloak `clenzy`)
1. **Required action `CONFIGURE_TOTP`** : activée (enabled) pour permettre l'enrôlement TOTP par l'utilisateur ; à passer en *Default Action* si on veut forcer l'enrôlement au prochain login.
2. **Browser flow avec OTP conditionnel / step-up** : ajouter un sous-flow `Conditional OTP` (REQUIRED quand l'utilisateur a un credential OTP, ou forcé selon un attribut). C'est ce qui produit un second facteur réel.
3. **Émission des claims** : mapper l'authentification dans le token —
   - `amr` (Authentication Methods References) : doit contenir `otp`/`mfa` quand un second facteur a été utilisé (protocol mapper).
   - et/ou `acr` (Authentication Context Class Reference) : niveau `aal2`/`2` via la config `acr-to-loa` du realm/client.
   Sans ces claims, `MfaPolicyEvaluator` ne peut pas constater la 2FA → l'enforcement (§3) refuserait tout le monde.
4. **Versionner** ces changements (realm export JSON dans `clenzy-infra`) — ne pas configurer « à la main » en prod.

## 3. À faire côté app (wiring — étape sensible, revue requise)
- Ajouter un point d'enforcement **après** le `TenantFilter`, qui :
  1. lit la policy : `Organization.mfaRequired` de l'org courante ;
  2. extrait `amr`/`acr` du `Jwt` courant ;
  3. appelle `MfaPolicyEvaluator.isAccessAllowed(orgMfaRequired, amr, acr)` ;
  4. si refusé → `403` avec un code applicatif `MFA_REQUIRED` (le front route vers l'enrôlement TOTP Keycloak).
- **Double garde-fou anti-lockout** (obligatoire) :
  - flag global `clenzy.security.mfa.enforcement-enabled=false` par défaut — l'enforcement ne s'active qu'une fois le realm (§2) configuré et vérifié ;
  - + la policy par org `mfaRequired` (déjà là).
  - Tant que le flag global est OFF, **zéro impact** (non-régression).
- L'intégration se fait dans la security chain (`SecurityConfigProd` / un `OncePerRequestFilter` enregistré) → **fichier sensible, à faire en PR dédiée revue**.

## 4. Séquence d'activation recommandée
1. clenzy-infra : §2 (required action + conditional OTP + claims) en staging.
2. App : §3 (filter d'enforcement, flag global OFF) — PR revue.
3. Tester en staging avec une org `mfaRequired=true` + un user ayant enrôlé TOTP → accès OK ; user sans 2FA → 403 `MFA_REQUIRED`.
4. Activer le flag global en prod, puis ouvrir `mfaRequired` org par org.

## 5. Statut
- App (policy + evaluator + tests) : **Fait** (CLZ-P0-09).
- Realm clenzy-infra (§2) + wiring sécurité (§3) : **À traiter (coordonné)** — voir HORS-PERIMETRE.
