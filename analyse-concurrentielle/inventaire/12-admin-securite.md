# Inventaire interne — Domaine 12 : Admin, sécurité & conformité

> **Source de vérité :** code `server/src/main/java/com/clenzy/`. Statut + preuve fichier.
> **Date :** 2026-06-13 · **Lot :** B9
> Grille 0–3 (0 absent · 1 basique · 2 standard marché · 3 avancé/différenciant).

---

## 1. Périmètre du domaine

Authentification & SSO, RBAC (rôles/permissions), multi-tenant, journal d'audit, RGPD, signature électronique des mandats (eIDAS/QTSP), 2FA/MFA, certifications (SOC 2 / ISO 27001 / PCI), conformité locale (déclaration voyageurs FR).

---

## 2. Constats code (vérité terrain)

### 2.1 Auth / SSO — **Implémenté**

- **Keycloak 24** : realm `clenzy` (PMS) + `clenzy-guests` (booking). OIDC/OAuth2.
- 2 realms = isolation guest/staff. SSO d'entreprise (SAML/Keycloak fédéré) **possible techniquement** via Keycloak mais **pas de connecteur SSO client documenté/proposé en self-service** repéré côté produit.
- **2FA/MFA :** géré au niveau Keycloak (OTP/TOTP configurables côté IdP). **Aucune implémentation 2FA applicative repérée** dans le code Clenzy (seul `YousignSignatureProvider` mentionne « otp » dans un autre contexte). → MFA = capacité de l'IdP, pas une feature produit exposée/forcée côté Clenzy.

### 2.2 RBAC — **Implémenté, solide**

- `config/PermissionInitializer.java` : seeding de permissions granulaires (constat code : ~45–52 entrées `ressource:action` distinctes selon comptage ; cadrage interne annonce **84 permissions**).
- `model/Permission.java`, `model/RolePermission.java`, `service/PermissionService.java`, `controller/PermissionController.java` : modèle rôle↔permission éditable.
- **8 rôles fonctionnels** (primer) : SUPER_ADMIN, SUPER_MANAGER, HOST, TECHNICIAN, HOUSEKEEPER, SUPERVISOR, + opérationnels (LAUNDRY, EXTERIOR_TECH) + BOOKING_GUEST. `model/Role.java` = entité dynamique (rôles persistés, display name, description) → rôles personnalisables.
- **Différenciant terrain :** rôles opérationnels métier conciergerie (technicien, ménage, lingerie, extérieur, superviseur) — plus fins que la moyenne PMS.

### 2.3 Multi-tenant — **Implémenté, avancé**

- `tenant/TenantFilter.java` : extraction org du JWT, **fail-closed** (403 si org non résolue). `@Filter` Hibernate sur les entités métier. Platform staff cross-org.
- `requireSameOrganization()` (pattern ownership) post-`findById`. Robuste (durci par l'audit 2026-06).

### 2.4 Journal d'audit — **Implémenté**

- `audit/AuditAspect.java` (AOP) + `service/AuditLogService.java` + `model/SecurityAuditLog` + `repository/SecurityAuditLogRepository.java` + `config/AuditLoggingInterceptor.java` + `config/SecurityAuditAccessDeniedHandler.java`.
- Audit de sécurité (accès refusés) + audit métier. `dto/SecurityAuditLogDto.java` exposé.

### 2.5 RGPD — **Implémenté, complet**

- `service/GdprService.java` : `exportUserData()` (portabilité), `anonymizeUser()` (droit à l'oubli), `getConsentStatus()` / `updateConsents()` (consentement horodaté + IP), `getDataCategories()`.
- `repository/GdprConsentRepository.java`, DTOs dédiés. → couverture RGPD réelle (export/oubli/consentement), pas un simple bandeau cookies.

### 2.6 Signature électronique — **Mixte (claim « 4 QTSP FR » FAUX)**

| Provider | Statut code réel | Preuve |
|----------|------------------|--------|
| **CLENZY_CUSTOM (SES interne)** | ✅ **Actif par défaut** : page `/sign/{token}`, preuve (IP, UA, horodatage, SHA-256, nom), certificat iText apposé | `ClenzyInternalSignatureProvider.java`, migration `0225` |
| **Yousign (QTSP FR, ANSSI)** | ⚠️ **Implémenté (client API v3 réel) mais NON branché** : actif seulement si `SIGNATURE_PROVIDER=yousign` + connexion org active | `integration/external/YousignSignatureProvider.java` (`@Service`) |
| **DocuSeal (open source, SES + PAdES)** | ⚠️ **Implémenté mais NON branché** : nécessite instance déployée + `SIGNATURE_PROVIDER=docuseal` | `integration/docuseal/DocuSealSignatureProvider.java` (`@Service`) |
| **DocuSign** | ⚠️ Connexion OAuth scaffold (`integration/docusign/`), **pas de provider de signature câblé** | `DocuSignSignatureProvider.java` (présent, non actif) |
| **Universign, DocaPoste, Pennylane, Odoo** | ❌ **Enums sans implémentation** | `SignatureProviderType.java` (valeurs seules) |

> **Correction de l'inventaire fourni :** Yousign et DocuSeal ne sont PAS de simples enums — ce sont des `@Service` avec clients API réels, **désactivés par défaut** (gate `SIGNATURE_PROVIDER` + connexion org). Seuls Universign/DocaPoste/Pennylane/Odoo sont des enums nus. Le claim marketing « 4 QTSP FR actifs + DocuSign + eIDAS QES » reste **FAUX** : aucun QTSP n'est branché en prod, seul le SES interne signe réellement.

### 2.7 Conformité locale — Déclaration voyageurs (FR) — **Scaffold only (pas fonctionnel)**

- `integration/compliance/` : gestion de **connexion** à un fournisseur de déclaration (`ComplianceProviderType` = **CHEKIN** (FR/ES/IT/PT), **POLICE_MA** (DGSN Maroc), **ABSHER_KSA**).
- **MAIS** : `StubComplianceConnectionTestStrategy` — accepte n'importe quelles credentials non-vides, **aucun appel API réel** (« no real API call yet »). Pas de soumission effective des fiches voyageurs aux autorités.
- → Verdict : **connexion stub** (niveau 1), pas une déclaration fonctionnelle. **L'inventaire fourni disait « absente » ; le code montre un scaffold de connexion non câblé** — même conclusion pratique (pas de feature utilisable), mais l'infrastructure existe.
- KYC : même pattern. `integration/kyc/` (Sumsub/Veriff/Onfido) = connexion + `StubKycConnectionTestStrategy`, non câblé au flux guest.

---

## 3. Score interne justifié

| Fonctionnalité (d12) | Score | Justification (preuve) |
|----------------------|:-----:|------------------------|
| Auth / SSO | **2** | Keycloak OIDC, 2 realms ; SSO entreprise non self-service |
| 2FA / MFA | **1** | Capacité IdP Keycloak, pas de feature produit forcée/exposée |
| RBAC rôles/permissions | **3** | 8 rôles + ~84 permissions granulaires, rôles métier terrain |
| Multi-tenant | **3** | TenantFilter fail-closed + ownership durci |
| Journal d'audit | **2** | AuditAspect + SecurityAuditLog (sécurité + métier) |
| RGPD | **3** | Export + oubli + consentement horodaté (GdprService complet) |
| Signature électronique mandats | **2** | SES interne actif (preuve iText) ; QTSP implémentés mais OFF |
| Certifications (SOC 2/ISO/PCI) | **0** | Aucune certification repérée (Keycloak/Stripe sous-jacents ≠ certif Clenzy) |
| Déclaration voyageurs FR | **1** | Scaffold connexion Chekin/Police, stub (pas de soumission réelle) |

**Score domaine 12 « nous » ≈ 1,9 → arrondi retenu : 2** (cohérent Phase 0). Forces = RBAC/multi-tenant/RGPD (avancés). Faiblesses = pas de certif, MFA non produit, QTSP non branché, déclaration voyageurs non fonctionnelle.

---

## 4. Écarts « marketing vs code »

| Claim | Réalité code | Verdict |
|-------|--------------|---------|
| « 4 QTSP FR (Yousign/Universign/DocaPoste) + DocuSign + QES eIDAS » | Seul SES interne actif ; Yousign+DocuSeal implémentés OFF ; reste = enums | ❌ Faux (claim QES) |
| « Déclaration voyageurs FR » | Scaffold connexion Chekin/Police en stub, pas de soumission | ❌ Non fonctionnel |
| « 84 permissions » | Code seed ~45–52 entrées distinctes selon comptage | ⚠️ À vérifier (ordre de grandeur OK) |
| « SOC 2 / ISO 27001 » | Aucune certification Clenzy repérée | ❌ Absent |
