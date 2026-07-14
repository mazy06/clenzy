#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere le PDF du rapport d'audit securite Baitly (2026-07-14) via le theme partage."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from baitly_pdf_theme import *  # noqa: F401,F403

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "security",
                   "audit-baitly-2026-07-14.pdf")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# --- helpers locaux (specifiques a ce document) ---
_SEV_COLOR = {"Critical": DANGER, "High": DANGER, "Medium": WARN,
              "Low-Med": WARN, "Low": MUTED}
_CODEBLOCK = ParagraphStyle("codeblock", parent=BODY, fontName="Courier",
                            fontSize=7.4, leading=10.4, textColor=INK,
                            backColor=colors.HexColor("#EEF1F3"),
                            borderPadding=6, spaceBefore=3, spaceAfter=7,
                            leftIndent=2, rightIndent=2)


def sev(label, cvss=None):
    txt = "<b>%s</b>" % label + (" &middot; %s" % cvss if cvss else "")
    color = _SEV_COLOR.get(label, INK)
    return Paragraph(txt, ParagraphStyle("sev", parent=CELLB, textColor=color, fontSize=8))


def codeblock(lines):
    return Paragraph("<br/>".join(esc(l) for l in lines), _CODEBLOCK)


def H(t):
    return Paragraph(t, H1)


def h2(t):
    return Paragraph(t, H2)


def h3(t):
    return Paragraph(t, H3)


def p(t):
    return Paragraph(t, BODY)


def b(t):
    return Paragraph(t, BULLET)


story = []

build_cover(
    story,
    eyebrow="SECURITE &middot; AUDIT DEFENSIF &middot; CONFIDENTIEL",
    title_lines=["Audit de sécurité", "applicatif <font color='#6B8A9A'>Baitly</font>"],
    subtitle="PMS location courte durée — audit défensif en lecture seule, 10 phases "
             "(isolation multi-tenant, auth, injections, paiements, secrets, Kafka, "
             "dépendances, RGPD, frontend).",
    meta_rows=[
        ("Date", "14 juillet 2026"),
        ("Périmètre", "dépôt clenzy (back Java 21 / Spring Boot 3.5.13, front React 18, mobile Expo, SDK)"),
        ("Findings", "30 — 1 Critical, 4 High, 12 Medium, 13 Low"),
        ("Verdict", "NO-GO GA en l'état (bloquants = quick wins)"),
    ],
)

# ---------------------------------------------------------------- 1. Resume
story.append(H("1. Résumé exécutif"))
story.append(p(
    "La plateforme présente une <b>base de sécurité mature</b> : deny-by-default, validation JWT "
    "durcie (issuer + audience + signature), chiffrement PII au repos, signatures webhook de "
    "paiement correctes, montants recalculés serveur, rate limiting robuste, gestion DLT/poison "
    "Kafka, aucun secret de prod en dur ni dans l'historique git, frontend sans sink XSS."))
story.append(p(
    "<b>Mais</b> l'isolation multi-tenant — risque n°1 d'un PMS SaaS — repose sur une architecture "
    "<b>fragile sans filet</b> : <b>pas de RLS PostgreSQL</b> et le filtre Hibernate "
    + code("organizationFilter") + " est <b>inerte sur les flux HTTP</b>. L'isolation dépend donc "
    "d'une vérification d'ownership explicite dans <b>chaque</b> endpoint. Plusieurs oublis "
    "produisent des <b>IDOR cross-tenant confirmés</b>, dont un critique."))

story.append(h2("Top 5 des risques"))
story.append(table(
    [hcells("#", "ID", "Risque", "Sévérité"),
     cells("1", "F1-01", "Tout utilisateur authentifié lit n'importe quelle réservation (PII guest, montants, statut paiement)", "") [:3] + [sev("Critical", "7.7")],
     cells("2", "F3-01", "SSRF non authentifiée avec exfiltration (snapshot Playwright + sous-ressources CSS non validées)", "")[:3] + [sev("High", "8.6")],
     cells("3", "F1-03", "Tout utilisateur authentifié initie le paiement / mute la facture d'un autre tenant", "")[:3] + [sev("High", "8.1")],
     cells("4", "F1-STRUCT", "Pas de RLS + filtre Hibernate inerte -> aucune seconde ligne de défense ; amplifie tous les IDOR", "")[:3] + [sev("High", "7.4")],
     cells("5", "F1-02", "Énumération cross-tenant de tout l'historique documentaire (emails, n° de factures) par un HOST", "")[:3] + [sev("High", "7.1")]],
    [8 * mm, 20 * mm, USABLE_W - 8 * mm - 20 * mm - 26 * mm, 26 * mm]))

story.append(h2("Verdict : NO-GO en l'état pour une mise en production commerciale grand public"))
story.append(p(
    "Le cluster d'IDOR cross-tenant (<b>F1-01 -> F1-09</b>) et la <b>SSRF anonyme (F3-01)</b> sont "
    "des <b>bloquants</b> : une fuite de données entre tenants et une SSRF non authentifiée sont "
    "incompatibles avec une commercialisation SaaS. Ce sont majoritairement des <b>quick wins</b> "
    "(ajout d'une garde d'ownership déjà standardisée dans le code via "
    + code("OrganizationAccessGuard") + ")."))
story.append(p(
    "<b>Go conditionnel</b> dès que : (a) les IDOR F1-01 -> F1-09 sont gardés, (b) F3-01 est corrigé "
    "(auth + IP épinglée), (c) le déficit structurel F1-STRUCT reçoit un filet (RLS ou réactivation "
    "du filtre par transaction)."))

story.append(table(
    [hcells("Sévérité", "Nombre"),
     cells("Critical", "1"), cells("High", "4"),
     cells("Medium", "12"), cells("Low", "13"),
     [Paragraph("<b>Total</b>", CELLB), Paragraph("<b>30</b>", CELLB)]],
    [40 * mm, USABLE_W - 40 * mm], align_center_cols=(1,)))

story.append(PageBreak())

# ---------------------------------------------------------------- 2. Tableau
story.append(H("2. Tableau des findings (trié par sévérité)"))

rows = [
    ("F1-01", "IDOR lecture — GET /api/reservations/{id}", "Critical", "7.7", "ReservationController.java:131"),
    ("F3-01", "SSRF anonyme + exfiltration (snapshot Playwright)", "High", "8.6", "SiteSnapshotService.java:132,263"),
    ("F1-03", "IDOR écriture — POST /api/invoices/{id}/pay", "High", "8.1", "InvoicePaymentService.java:39"),
    ("F1-STRUCT", "Pas de RLS + filtre Hibernate inerte en HTTP", "High", "7.4", "TenantFilter.java:300"),
    ("F1-02", "Énumération cross-tenant historique documentaire", "High", "7.1", "DocumentController.java:238"),
    ("F4-01", "Webhook Wise fail-open sur signature (latent)", "Medium", "7.5*", "WiseWebhookController.java:75"),
    ("F1-04", "IDOR écriture — POST /api/invoices/{id}/send", "Medium", "6.5", "InvoicePaymentService.java:98"),
    ("F6-01", "Broker Kafka PLAINTEXT par défaut (pas d'auth/ACL/TLS)", "Medium", "6.5", "application-prod.yml:72"),
    ("F6-02", "Consumers Kafka de confiance -> forge d'events", "Medium", "6.5", "DocumentEventService.java:44"),
    ("F1-05..09", "Cluster IDOR ServiceRequest + docs by-reference", "Medium", "~6", "ServiceRequestController.java"),
    ("F1-10", "Consumers Kafka sans re-scoping tenant", "Medium", "~5.5", "18 @KafkaListener"),
    ("F3-02", "DNS rebinding TOCTOU — fetch site (analyse IA)", "Medium", "5.4", "WebsiteFetchService.java:59"),
    ("F3-06", "IA : règles de confiance auto-approuvent écritures non-argent", "Medium", "5.4", "AgentTrustRuleService.java:44"),
    ("F7-01", "Gate SCA non bloquant (illusoire)", "Medium", "5.3", "ci-backend.yml:141"),
    ("F3-03", "DNS rebinding TOCTOU — webhooks sortants", "Medium", "5.0", "WebhookDeliveryService.java:131"),
    ("F3-07", "IA : remember_fact écrit sans confirmation (memory poisoning)", "Medium", "5.0", "RememberFactTool.java:116"),
    ("F8-01", "Purge de rétention désactivée en prod (PII indéfinie)", "Medium", "RGPD", "RetentionPurgeScheduler"),
    ("F8-02", "Pas de droits data-subject pour les Guests/voyageurs", "Medium", "RGPD", "GdprService.java:186"),
    ("F4-02", "completeTransaction sans garde de concurrence forte", "Medium", "4.8", "PaymentPersistence.java:191"),
    ("F3-04", "Source caméra RTSP/HTTP -> go2rtc sans validation", "Low-Med", "4.9", "CameraService.java:152"),
    ("F9-01", "Open redirect via successUrl/cancelUrl non validés", "Low-Med", "4.7", "StripePaymentProvider.java:70"),
    ("F2-01", "Autorisation fonctionnelle manquante (templates WhatsApp)", "Low-Med", "4.3", "WhatsAppTemplateController.java"),
    ("F5-01", "Secrets test/local commités", "Low-Med", "4.0", "application-local.yml:55"),
    ("F3-08", "IA : résultats d'outils réinjectés sans échappement", "Low", "-", "AgentToolLoopRunner.java:225"),
    ("F3-05", "ICalUrlValidator ne bloque pas IPv6 ULA/mapped", "Low", "3.7", "ICalUrlValidator.java:117"),
    ("F5-03", "proxy_ssl_verify off sur upstream SSL", "Low", "3.7", "nginx.prod.conf:153"),
    ("F1-11", "InterventionAccessPolicy fail-open sur org NULL", "Low", "3.7", "InterventionAccessPolicy.java:47"),
    ("F2-02", "Mapping de rôle fragile ADMIN/MANAGER -> SUPER_*", "Low", "3.7", "SecurityConfigProd.java:301"),
    ("F2-03", "Logout sans révocation Keycloak", "Low", "3.1", "AuthSessionController.java:226"),
    ("F5-02", "CSP unsafe-inline/unsafe-eval + incohérences en-têtes", "Low", "3.1", "nginx.prod.conf:53"),
    ("F4-03/04", "Double résa legacy / retry 200-avaleur", "Low", "-", "PublicBookingService.java:1475"),
    ("F6-03/F8-04", "PII (email) loggée en clair (PiiMasker incohérent)", "Low", "-", "DocumentEventService.java:71"),
    ("F7-02/03", "Vulns front non patchées / currence versions backend", "Low", "-", "npm audit ; pom.xml"),
]
data = [hcells("ID", "Titre", "Sévérité", "Emplacement")]
for fid, title, s, cvss, loc in rows:
    data.append([Paragraph("<b>%s</b>" % fid, CELL), Paragraph(esc(title), CELL),
                 sev(s, cvss if cvss not in ("-",) else None),
                 Paragraph("<font face='Courier' size='7'>%s</font>" % esc(loc), CELL)])
story.append(table(data, [21 * mm, USABLE_W - 21 * mm - 24 * mm - 46 * mm, 24 * mm, 46 * mm]))
story.append(Paragraph("* CVSS de F4-01 si l'endpoint est whitelisté (actuellement neutralisé par l'absence de permitAll).", CAP))

story.append(PageBreak())

# ---------------------------------------------------------------- 3. Detail
story.append(H("3. Détail des findings prioritaires"))

story.append(h2("F1-STRUCT — Isolation 100 % applicative, sans filet (High, 7.4)"))
story.append(p("Cause racine de tout le cluster IDOR. Deux défenses théoriques sont absentes/inertes :"))
story.append(b("<b>Aucune RLS PostgreSQL</b> (aucune CREATE POLICY / ENABLE ROW LEVEL SECURITY dans les changesets Liquibase)."))
story.append(b("<b>Filtre Hibernate inerte sur les flux HTTP</b> : " + code("open-in-view: false") + " sur les 4 profils, "
               "et aucun aspect ne réactive le filtre par transaction. Les 3 seuls " + code("enableFilter") + " sont hors flux HTTP."))
story.append(codeblock([
    "// TenantFilter.java:300 — le filtre echoue silencieusement au niveau servlet",
    "private void enableHibernateOrgFilter(Long orgId) {",
    "  try {",
    "    Session session = entityManager.unwrap(Session.class); // IllegalStateException (open-in-view=false)",
    "    session.enableFilter(\"organizationFilter\").setParameter(\"orgId\", orgId);",
    "  } catch (IllegalStateException e) {",
    "    logger.debug(\"filtre Hibernate non activable ...\"); // avale -> filtre INERTE en HTTP",
    "  }",
    "}"]))
story.append(p("<b>Conséquence</b> : chaque " + code("findById") + " en flux HTTP dépend d'une garde explicite. Toute garde oubliée = fuite cross-tenant totale, sans seconde ligne de défense."))
story.append(p("<b>Correctif</b> : RLS Postgres (policy " + code("USING (organization_id = current_setting('app.current_org')::bigint)") + ") <b>ou</b> un aspect " + code("@Around") + " sur " + code("@Transactional") + " qui réactive le filtre depuis le TenantContext."))

story.append(h2("F1-01 — IDOR lecture GET /api/reservations/{id} (Critical, 7.7)"))
story.append(Paragraph("<font face='Courier' size='7.5'>AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N</font>", SMALL))
story.append(codeblock([
    "// ReservationController.java:131 — classe @PreAuthorize(\"isAuthenticated()\") seulement",
    "@GetMapping(\"/{id}\")",
    "public ResponseEntity<ReservationDto> getById(@PathVariable Long id) {",
    "  Reservation r = reservationService.getByIdFetchAll(id); // WHERE r.id = :id (aucun org)",
    "  return ResponseEntity.ok(reservationMapper.toDto(r));   // aucun validatePropertyAccess",
    "}"]))
story.append(p("<b>Exploitabilité</b> : n'importe quel utilisateur authentifié (même HOUSEKEEPER) itère " + code("id") + " et lit toute réservation de tout tenant (PII guest, montants, statut paiement, codes d'accès). Les endpoints voisins (update, cancel, sendPaymentLink) appellent bien " + code("validatePropertyAccess") + " — seul " + code("getById") + " a été oublié."))
story.append(p("<b>Correctif</b> : appeler " + code("validatePropertyAccess(reservation.getProperty().getId(), jwt)") + " (garde déjà utilisée par les autres endpoints du controller)."))

story.append(h2("F1-03 — IDOR écriture POST /api/invoices/{id}/pay (High, 8.1)"))
story.append(codeblock([
    "// InvoicePaymentService.java:39 — aucun controle d'org",
    "public PaymentOrchestrationResult payInvoice(Long invoiceId, ...) {",
    "  Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow(...); // pas de requireSameOrganization",
    "  invoice.setPaymentTransactionId(result.transaction().getId());           // mutation cross-tenant",
    "  invoiceRepository.save(invoice);",
    "}"]))
story.append(p("Tout utilisateur authentifié initie l'orchestration de paiement et mute la facture d'un autre tenant. " + code("sendInvoice") + " (F1-04) a le même défaut. Dans le même controller, getInvoice/pdf/issue/cancel sont org-validés. <b>Correctif</b> : " + code("organizationAccessGuard.requireSameOrganization(invoice.getOrganizationId(), ...)") + " avant toute action."))

story.append(h2("F1-02 — Énumération cross-tenant de l'historique documentaire (High, 7.1)"))
story.append(codeblock([
    "// DocumentController.java:238",
    "@GetMapping(\"/generations\")",
    "@PreAuthorize(\"hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','ADMIN','HOST')\") // HOST = tenant-scoped",
    "// -> DocumentGeneratorService.listGenerations -> findAllByOrderByCreatedAtDesc(pageable)",
    "//    AUCUN filtre organization_id, aucun post-filtre"]))
story.append(p("Un HOST pagine l'historique de génération documentaire de tous les tenants (emails destinataires, numéros légaux de factures). L'endpoint voisin " + code("getGenerationsByReference") + " post-filtre par email pour les non-staff — oubli isolé. <b>Correctif</b> : " + code("findAllByOrganizationIdOrderByCreatedAtDesc(orgId, pageable)") + "."))

story.append(h2("F3-01 — SSRF non authentifiée + exfiltration (High, 8.6)"))
story.append(Paragraph("<font face='Courier' size='7.5'>AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:L/A:N</font>", SMALL))
story.append(codeblock([
    "// /api/public/preview-proxy/snapshot?url=  (ANONYME)",
    "private void validateUrl(String url){ ICalUrlValidator.validateAndResolve(url); } // IP epinglee JETEE",
    "page.navigate(url, ...);                        // suit les 3xx + re-resout le DNS (rebinding)",
    "String css = Jsoup.connect(href).execute().body(); // href de la page attaquante, AUCUNE validation",
    "link.after(\"<style>\" + css + \"</style>\");        // CSS interne INLINE dans la reponse -> exfiltration"]))
story.append(p("Anonyme. Une URL publique validée qui redirige vers " + code("169.254.169.254") + " / une IP interne est rendue par Chromium ; et les " + code("&lt;link rel=stylesheet&gt;") + " de la page attaquante permettent de fetch n'importe quelle URL interne et d'<b>inliner la réponse</b> dans le HTML retourné (metadata cloud, MinIO, actuator, go2rtc)."))
story.append(p("<b>Correctif</b> : retirer l'accès anonyme + intercepter chaque requête Playwright (Route) qui revalide l'IP + valider les href CSS via " + code("ICalUrlValidator") + " et router via le pattern IP-épinglée (" + code("PinnedSiteFetcher") + ")."))

story.append(h2("F4-01 — Webhook Wise fail-open (Medium / High à l'activation)"))
story.append(codeblock([
    "// WiseWebhookController.java:75  — wise.public-key absente de application-prod.yml",
    "if (wisePublicKeyPem != null && !wisePublicKeyPem.isBlank()) { ... verifie ... }",
    "else { log.warn(\"verification de signature desactivee (wise.public-key vide)\"); } // FAIL-OPEN"]))
story.append(p("Un payload non signé forgé passerait un payout en PAID/FAILED. <b>Actuellement neutralisé</b> car " + code("/api/webhooks/payouts/**") + " n'est pas dans le permitAll (403). Devient exploitable dès l'activation de Wise. Contraste : GoCardless rejette (503) si le secret est absent. <b>Correctif</b> : fail-closed."))

story.append(h2("F6-01 — Broker Kafka PLAINTEXT par défaut (Medium, 6.5)"))
story.append(codeblock([
    "# application-prod.yml:72",
    "security.protocol: ${KAFKA_SECURITY_PROTOCOL:PLAINTEXT}  # SASL/SSL cables mais desactives",
    "sasl.jaas.config: ${KAFKA_SASL_JAAS_CONFIG:}             # vide"]))
story.append(p("Sans " + code("SASL_SSL") + " en prod : aucune auth, aucun chiffrement, aucune ACL -> toute partie avec accès réseau au broker produit/consomme tous les topics. Cela rend exploitables les gaps de confiance des consumers (F6-02 : forge d'un event " + code("documents.generate") + " -> document d'un autre tenant envoyé à une adresse arbitraire). Sévérité finale conditionnée à l'isolation réseau du broker (à confirmer dans clenzy-infra)."))
story.append(Paragraph("Les findings restants (F1-04 -> F1-11, F2-*, F3-02 -> F3-09, F4-02 -> F4-04, F5-*, F6-03, F7-*, F8-*, F9-01) sont détaillés dans le rapport Markdown avec fichier:ligne et correctifs.", CAP))

story.append(PageBreak())

# ---------------------------------------------------------------- 4. Remediation
story.append(H("4. Plan de remédiation priorisé"))

story.append(h3("Quick wins (< 1 jour) — bloquants GA"))
story.append(b("<b>F1-01 -> F1-09</b> : ajouter la garde " + code("requireSameOrganization(entity.getOrganizationId())") + " (déjà standardisée) sur chaque endpoint IDOR : réservations getById, invoices pay/send, cluster ServiceRequest, documents generations/by-reference."))
story.append(b("<b>F3-01</b> : retirer l'accès anonyme au snapshot + IP épinglée sur la page ET les sous-ressources CSS."))
story.append(b("<b>F4-01</b> : rendre la vérif de signature Wise obligatoire (fail-closed) avant toute activation."))

story.append(h3("Court terme (< 1 semaine)"))
story.append(b("<b>F1-STRUCT</b> : introduire un filet — RLS Postgres ou réactivation du filtre Hibernate par transaction. Le changement le plus structurant : sans lui, chaque nouvel endpoint reste un IDOR potentiel."))
story.append(b("<b>F6-01/F6-02</b> : activer SASL_SSL + ACL Kafka ; enrober les consumers via " + code("TenantScopedExecutor") + " + revalider l'appartenance des referenceId / escrow-réservation."))
story.append(b("<b>F3-02/03/04</b> : router les fetch/webhooks sortants via le pattern IP-épinglée ; allow-list schéma/hôte pour les sources caméra."))
story.append(b("<b>F3-06/07</b> : élargir la liste non-auto-approuvable IA aux tools de communication/annulation ; reclasser remember_fact en écriture tracée."))
story.append(b("<b>F7-01</b> : rendre le gate SCA bloquant (retirer " + code("|| true") + " / " + code("continue-on-error") + ", failBuildOnCVSS=7) ; npm audit fix."))
story.append(b("<b>F4-02/03</b> : contrainte unique idempotency_key + UPDATE conditionnel ; index unique stripe_session_id."))

story.append(h3("Structurel / conformité"))
story.append(b("<b>F8-01/02</b> : activer la purge de rétention en prod (durées légales par catégorie) ; étendre l'effacement/export aux Guest/GuestDeclaration."))
story.append(b("<b>F8-03</b> : confirmer DPA/SCCs avec les sous-traitants LLM US (Anthropic/OpenAI/Voyage) ; minimiser la PII dans les prompts."))
story.append(b("<b>F5-01</b> : révoquer/roter les secrets test commités, externaliser."))
story.append(b("<b>F5-02/03, F2-*, F9-01, F6-03</b> : durcir CSP (nonces) ; confirmer proxy_ssl_verify ; allow-list rôle templates WhatsApp + mapping de rôle strict + révocation logout ; allow-list URLs de retour paiement ; masquage PII en logs."))
story.append(b("<b>Hors-repo (clenzy-infra / clenzy-sites)</b> : ACL bucket OVH/MinIO privé ; secrets docker-compose ; sanitisation + CSP du SSR des sites publiés."))

story.append(H("5. Points positifs (à préserver)"))
for t in [
    "<b>Deny-by-default</b> (" + code("anyRequest().denyAll()") + ") ; profils de sécurité en liste positive + EnvironmentValidator fail-fast (pas de admin/admin, JASYPT requis).",
    "<b>Validation JWT durcie</b> : issuer + audience (clenzy-api) + signature JWKS + timestamps -> rejette cross-realm ET cross-client.",
    "<b>Résolution tenant fail-closed</b>, dérivée du JWT seul ; garde centralisée OrganizationAccessGuard (fail-closed) largement utilisée.",
    "<b>Paiements</b> : signatures webhook correctes (Stripe/CMI/Attijari/PayTabs/Payzone), montants recalculés serveur (cross-check 400), StripeAmounts.toMinorUnits (HALF_UP), transitions gardées (CAS), secrets chiffrés per-org, aucun log de PAN/CVV/secret.",
    "<b>Pas d'injection SQL</b> ; import iCal SSRF-safe (IP épinglée) ; scoping tenant des agents IA solide (le LLM ne fournit jamais l'org ; RAG scopé org ; tools argent jamais auto-approuvés ; HITL structurel).",
    "<b>Rate limiting robuste</b> (Lua atomique, brute-force, IP anti-spoofing) ; uploads validés ; DLT/poison Kafka robustes.",
    "<b>Cookies BFF</b> HttpOnly/Secure/SameSite=Strict ; frontend sans sink XSS (HTML non fiable sandboxé) ; tokens mobile en SecureStore ; PII chiffrée au repos ; en-têtes/TLS nginx solides ; aucun secret de prod en dur ni dans l'historique git.",
]:
    story.append(b(t))

make_doc(OUT,
         title="Baitly - Audit de securite 2026-07-14",
         footer_label="Baitly · Audit de sécurité · 2026-07-14 · Confidentiel",
         cover_ref="Baitly · docs/security/audit-2026-07-14.md").build(story)

print("PDF genere :", OUT)
