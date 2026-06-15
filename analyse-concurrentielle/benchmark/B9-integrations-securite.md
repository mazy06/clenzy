# B9 — Intégrations & API (D10) + Admin, sécurité & conformité (D12)

> **Lot :** B9 · **Date :** 2026-06-13 · **Grille :** 0–3 (cf. cadrage Phase 0).
> **Méthode :** Clenzy = preuve code (`inventaire/10-*.md`, `inventaire/12-*.md`). Concurrents = veille web 2025-2026, datée, sourcée, niveau de confiance (`Confirmé`/`Probable`/`À vérifier`).
> Panel : Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily. Référentiels IoT cités : Operto, RemoteLock.

---

## 1. Synthèse exécutive

**Deux domaines secondaires en pondération (6 % + 5 %), mais deux faces du même enjeu : « est-ce que je peux brancher Clenzy à mon écosystème, et est-ce que je peux le confier à une équipe en confiance ? ».** Sur les deux, Clenzy est **sous la moyenne du panel**, dominé par les pure players SaaS US (Guesty, Hostaway).

- **D10 (intégrations) :** Clenzy **1,4/3**, dernier ex-aequo avec Smoobu. Sa force IoT/serrures (Nuki rotation auto, go2rtc) est réelle et différenciante, mais elle est noyée par un **marketplace mince (12 entrées, plusieurs vitrines)**, l'**absence de Zapier/Make**, l'**absence d'OTA partenaires** (HomeToGo/GYG/Klook) et une **API « développeur » non ouverte au grand public**. Les leaders ont 100–200+ intégrations + self-service partenaire + Zapier (1000–2000+ apps).
- **D12 (sécurité/conformité) :** Clenzy **1,6/3**, dans le ventre mou. Le socle technique (RBAC granulaire, multi-tenant fail-closed, RGPD export/oubli) est **objectivement bon, voire meilleur que la moyenne**. Mais trois trous pèsent : **aucune certification (SOC 2/ISO 27001)** là où Guesty est PCI Level 1 + SOC 2, **2FA non exposée en produit** (capacité IdP seulement) alors que Hostaway/Lodgify la rendent obligatoire, et **déclaration voyageurs FR + QTSP non fonctionnels** (scaffolds/stubs).

**Le contraste central :** Clenzy a un **moteur de permissions/tenancy de niveau enterprise** mais une **enveloppe de confiance et d'écosystème de niveau early-stage**. Pour une cible conciergerie FR, les manques les plus saignants sont commercialement visibles : pas de SOC 2 (frein grands comptes), pas de Zapier (frein « je branche mes outils »), déclaration police FR non câblée (obligation légale).

---

## 2. Domaine 10 — Intégrations & API / Écosystème

### 2.1 Sous-matrice D10

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|----------------|:------:|:--------:|:------:|:------:|:-------:|:----------:|:-------:|:-----:|
| Marketplace / app-store | 1 | 3 | 3 | 2 | 2 | 2 | 2 | 2 |
| Nombre d'intégrations catalogue | 1 | 3 | 3 | 2 | 2 | 2 | 2 | 2 |
| API publique développeur | 2 | 3 | 3 | 2 | 2 | 3 | 2 | 3 |
| Webhooks sortants | 2 | 3 | 3 | 2 | 2 | 3 | 2 | 2 |
| Zapier / Make natif | 0 | 2 | 3 | 2 | 3 | 3 | 1 | 1 |
| Serrures connectées | 3 | 2 | 3 | 2 | 2 | 3 | 2 | 2 |
| Capteurs bruit | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 1 |
| Caméras / streaming | 2 | 1 | 1 | 0 | 0 | 1 | 1 | 0 |
| OTA partenaires non-channel | 0 | 2 | 2 | 1 | 1 | 1 | 3 | 2 |
| Connecteurs comptables | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 |
| Outils ménage tiers | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 3 |
| Self-service partenaire marketplace | 0 | 3 | 3 | 1 | 1 | 1 | 2 | 2 |
| **Moyenne** | **1,4** | **2,4** | **2,6** | **1,5** | **1,7** | **2,1** | **1,8** | **1,8** |

### 2.2 Lecture

- **Guesty (2,6)** et **Hostaway (2,4)** dominent : marketplace ouvert (**Guesty 150–200+** items, **Hostaway 100+**, certains supports annonçant 200+), API publique documentée, **Zapier** (Guesty = 2000+ apps), self-service partenaire. Référence « écosystème ».
- **Hospitable (2,1)** : petit catalogue mais **API v2 propre (PAT + webhooks Reservations/Properties/Messages/Reviews)** + Zapier direct → très orienté « brancher des automatisations ».
- **Avantio (1,8)** : marketplace correct + **fort sur l'OTA partenaire** (Elite Connectivity Partner HomeToGo 2025) — là où Clenzy met 0.
- **Smily (1,8)** : Channel API + App Center (SuiteOp, Nuki) ; 70+ OTA.
- **Smoobu (1,5) / Lodgify (1,7)** : API publique + webhooks + Nuki/serrures + Zapier, mais marketplace plus réduit.
- **Clenzy (1,4) :** seul à scorer **3 sur serrures** (Nuki + rotation auto + KeyNest + Igloohome catalogue) et **2 sur caméras/streaming** (go2rtc, rare chez les PMS généralistes). Mais **0 sur Zapier**, **0 sur OTA partenaires**, **1 sur marketplace** (12 entrées dont vitrines) et **0 sur self-service partenaire**.

### 2.3 Référentiels IoT (hors panel PMS)

- **Operto / RemoteLock** = spécialistes accès & devices : RemoteLock fédère des dizaines de marques de serrures (Yale, Schlage, August, Kwikset…) ; Operto orchestre accès + énergie + bruit. Clenzy joue dans cette cour côté serrures (Nuki/KeyNest) et dépasse les PMS généralistes sur le **streaming caméra**, mais ne couvre pas l'ampleur multi-marques de ces spécialistes.

---

## 3. Domaine 12 — Admin, sécurité & conformité

### 3.1 Sous-matrice D12

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|----------------|:------:|:--------:|:------:|:------:|:-------:|:----------:|:-------:|:-----:|
| Auth / SSO entreprise | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 |
| 2FA / MFA | 1 | 3 | 3 | 2 | 3 | 2 | 2 | 2 |
| RBAC rôles & permissions | 3 | 2 | 3 | 1 | 2 | 2 | 2 | 2 |
| Multi-tenant / multi-owner | 3 | 2 | 3 | 1 | 1 | 1 | 3 | 2 |
| Journal d'audit | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 |
| RGPD (export/oubli/consentement) | 3 | 2 | 3 | 2 | 2 | 2 | 2 | 3 |
| Signature électronique mandats | 2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 |
| Signature QES eIDAS via QTSP | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Certifications SOC 2 / ISO 27001 | 0 | 1 | 3 | 1 | 1 | 1 | 1 | 1 |
| Conformité PCI DSS | 1 | 2 | 3 | 2 | 2 | 2 | 2 | 2 |
| Déclaration voyageurs FR | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 1 |
| Vérification identité / KYC | 1 | 2 | 2 | 1 | 2 | 2 | 1 | 1 |
| **Moyenne** | **1,6** | **1,8** | **2,3** | **1,3** | **1,7** | **1,4** | **1,7** | **1,6** |

### 3.2 Lecture

- **Guesty (2,3)** : seul vraiment au-dessus. **PCI DSS Level 1 + SOC 2 + RGPD** documentés (case study Scytale 2025), RBAC riche, SSO entreprise. C'est le standard « confiance grand compte ».
- **Hostaway (1,8) / Lodgify (1,7) :** **2FA obligatoire** (Hostaway SMS/email magic link ; Lodgify SMS, en cours de généralisation + détection d'anomalies/IP filtering). Là où Clenzy ne propose pas de 2FA produit.
- **Avantio (1,7)** : multi-owner fort (agences EU), reste discret sur les certifications publiques.
- **Smoobu (1,3) :** GDPR/DPA OK, **2FA email optionnelle**, mais RBAC/multi-tenant minces (cible petits hôtes).
- **Clenzy (1,6) :** **profil atypique** — meilleur que la moyenne sur **RBAC (3)**, **multi-tenant (3)** et **RGPD (3)** ; au-dessus sur **signature mandat (2)** grâce au SES interne (la plupart des PMS n'ont qu'une signature d'accord locatif guest, niveau 1). **Mais tiré vers le bas** par : **2FA (1)**, **certifications (0)**, **PCI (1)**, **déclaration FR (1, stub)**, **KYC (1, stub)**.

### 3.3 Points de vérité à corriger (vs claims internes)

- **« 4 QTSP FR + DocuSign + QES eIDAS » = FAUX.** En prod, seul **CLENZY_CUSTOM (SES)** signe réellement. **Yousign et DocuSeal sont implémentés** (clients API réels, `@Service`) **mais désactivés par défaut** (gate `SIGNATURE_PROVIDER` + connexion org). Universign/DocaPoste/Pennylane/Odoo = enums nus. **Aucun PMS du panel n'offre la QES eIDAS** non plus (score 0 partout) → ce n'est pas un retard, c'est un standard de marché inexistant. La signature de **mandat de gestion** par SES interne est en revanche un **léger avantage** (Clenzy 2 vs panel 0–1).
- **Déclaration voyageurs FR :** Clenzy a le **scaffold de connexion (Chekin/Police MA/Absher)** mais en **stub** (pas de soumission). Les concurrents s'appuient sur **Chekin en intégration native** (Hostaway, Guesty, Lodgify, Smoobu, Avantio sont partenaires Chekin) → ils offrent la **fonction réelle** (envoi automatique à la police FR à 23h, tenue 6 mois). **C'est là le gap le plus concret pour la cible FR.**

---

## 4. Top 3 gaps Clenzy (vs panel)

### D10
1. **Marketplace + self-service partenaire absents** — Guesty/Hostaway ont 100–200+ intégrations et un onboarding partenaire ouvert ; Clenzy a 12 entrées en dur (dont vitrines) et aucun self-service. *(Confiance : Confirmé)*
2. **Zapier/Make manquant** — tous les leaders (et même Smoobu/Lodgify/Hospitable) exposent Zapier (1000–2000+ apps) ; Clenzy = 0. C'est le levier « brancher n'importe quel outil » le moins cher à offrir. *(Confirmé)*
3. **OTA partenaires (HomeToGo/GYG/Klook) absents** — Avantio est Elite Partner HomeToGo 2025 ; Clenzy reste au stade handoff. *(Probable)*

### D12
1. **Aucune certification SOC 2 / ISO 27001** — Guesty = SOC 2 + PCI Level 1 ; pour vendre à des conciergeries gérant des centaines de lots / des grands comptes, l'absence de SOC 2 est un frein commercial direct. *(Probable)*
2. **2FA non exposée en produit** — Hostaway et Lodgify la rendent obligatoire ; Clenzy ne propose pas de second facteur applicatif (capacité Keycloak non câblée/forcée). *(Confirmé côté concurrents ; constat code interne)*
3. **Déclaration voyageurs FR non fonctionnelle** — scaffold stub vs intégration Chekin native chez 5 concurrents. Obligation légale FR → manque visible pour la cible. *(Confirmé)*

---

## 5. Top 3 avantages Clenzy (vs panel)

### D10
1. **Serrures connectées au niveau 3** — Nuki avec **rotation automatique des codes** (migration 0220) + KeyNest + Igloohome ; au-dessus de Hostaway/Smoobu/Avantio (niveau 2). *(Confirmé interne)*
2. **Streaming caméra (go2rtc)** — capacité WebRTC/RTSP/HLS déployée que les PMS généralistes n'ont pas (score 2 vs 0–1). Différenciant niche. *(Confirmé interne)*
3. **Webhooks signés + clés API chiffrées par org** — base technique propre (`X-Clenzy-Event`, `ApiKeyEncryptionService`), au niveau standard du marché. *(Confirmé interne)*

### D12
1. **RBAC granulaire orienté terrain (3)** — 8 rôles dont métiers conciergerie (technicien, ménage, lingerie, extérieur, superviseur) + ~84 permissions ; plus fin que Hostaway/Smoobu/Lodgify. *(Confirmé interne)*
2. **Multi-tenant fail-closed + RGPD complet (3 / 3)** — `TenantFilter` 403-par-défaut + ownership durci, et `GdprService` (export/oubli/consentement horodaté) réellement implémenté, pas un bandeau. Au-dessus de la moyenne du panel. *(Confirmé interne)*
3. **Signature SES interne du mandat de gestion (2)** — `/sign/{token}` + preuve (IP/UA/SHA-256) + certificat iText ; la plupart des PMS n'ont qu'une signature d'accord guest. Léger avantage. *(Confirmé interne)*

---

## 6. Parités (zones d'égalité avec le marché)

- **API publique + webhooks (D10) :** niveau **standard (2)** comme Smoobu/Avantio — fonctionnel mais à maturer (ni portail dev public, ni SDK). Parité basse.
- **Auth / SSO de base (D12) :** OIDC Keycloak = parité avec le panel (2), Guesty au-dessus sur le SSO entreprise self-service.
- **Journal d'audit (D12) :** niveau **2** comme Hostaway/Guesty/Avantio. Parité.
- **QES eIDAS (D12) :** **0 partout** — personne n'offre la signature qualifiée ; non-sujet concurrentiel.
- **Connecteurs comptables / outils ménage tiers (D10) :** niveau 2, parité avec la majorité (Pennylane câblé compense le retard QB/Xero).

---

## 7. Initiatives recommandées (ICE-like)

> Format : `Titre | Type | Impact(1-3) | Effort(S/M/L) | Reach(1-3) | Confiance(0.1-1.0)`

1. **Câbler la déclaration voyageurs FR via Chekin (sortir du stub)** | Conformité D12 | Impact 3 | Effort M | Reach 3 | Confiance 0.8
   — Le scaffold `integration/compliance` existe déjà (CHEKIN). Remplacer `StubComplianceConnectionTestStrategy` par l'appel API réel + flux d'envoi automatique. Obligation légale FR → bloquant commercial levé, et tous les concurrents l'ont déjà via Chekin.
2. **Connecteur Zapier (ou Make) sur les webhooks existants** | Intégration D10 | Impact 3 | Effort S/M | Reach 3 | Confiance 0.7
   — Les webhooks `X-Clenzy-Event` + clés API sont déjà là ; publier une app Zapier (triggers réservation/paiement/intervention) ouvre 1000+ intégrations à coût marginal. Parité immédiate avec Smoobu/Lodgify/Hospitable.
3. **2FA/TOTP applicative obligatoire (exploiter Keycloak)** | Sécurité D12 | Impact 2 | Effort S | Reach 3 | Confiance 0.8
   — Activer/forcer l'OTP Keycloak + UX d'enrôlement côté PMS. Hostaway/Lodgify le rendent obligatoire ; comble un gap visible et peu coûteux (l'IdP le supporte déjà).
4. **Trajectoire SOC 2 Type I → II** | Conformité D12 | Impact 3 | Effort L | Reach 2 | Confiance 0.6
   — Investissement long mais déterminant pour les conciergeries multi-centaines de lots / appels d'offres. Guesty en a fait un argument. Priorité moyenne (effort L), mais à inscrire à la roadmap.
5. **Ouvrir le marketplace : portail dev + 2-3 intégrations câblées de plus + self-service partenaire** | Intégration D10 | Impact 2 | Effort M/L | Reach 2 | Confiance 0.6
   — Documenter l'API `/api/developer`, transformer les vitrines (Beyond, QuickBooks/Xero) en intégrations réelles ou les retirer, et préparer un onboarding partenaire. Réduit l'écart vs Hostaway/Guesty.
