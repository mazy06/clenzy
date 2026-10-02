package com.clenzy.service.agent.supervision;

import com.clenzy.model.DeclarationStatus;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.ManagementContract;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.service.compliance.ObligationOwnership;
import com.clenzy.service.signature.ContractSignatureService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Règle de scan DÉTERMINISTE (agent Conformité « cmp », constellation métiers Phase 2) :
 * <ul>
 *   <li><b>Fiches police</b> : déclarations COMPLÉTÉES non télédéclarées → carte HITL
 *       {@code POLICE_DECLARE} par réservation (« Télédéclarer ») ;</li>
 *   <li><b>Mandats de gestion</b> : contrat DRAFT du logement sans AUCUNE demande de
 *       signature → carte {@code MANDATE_SIGN_SEND} (« Envoyer pour signature »).
 *       Une demande déjà partie (PENDING/SIGNED/EXPIRED) ne produit rien : le relancement
 *       d'une demande expirée reste un geste volontaire depuis l'écran Contrats.</li>
 * </ul>
 *
 * <p>Zéro coût token. Dédup par intitulé stable (ids). Best-effort.</p>
 */
@Service
public class ComplianceScanner {

    private static final Logger log = LoggerFactory.getLogger(ComplianceScanner.class);
    private static final String MODULE_CMP = "cmp";

    /** Fenêtre de rappel de la taxe de séjour : les N premiers jours du trimestre. */
    static final int TAX_REMINDER_WINDOW_DAYS = 21;

    private final GuestDeclarationRepository declarationRepository;
    private final ManagementContractRepository contractRepository;
    private final ContractSignatureService contractSignatureService;
    private final com.clenzy.service.TouristTaxService touristTaxService;
    private final com.clenzy.service.TaxFilingService taxFilingService;
    private final com.clenzy.repository.PropertyRepository propertyRepository;
    private final com.clenzy.repository.PropertyLicenseRepository propertyLicenseRepository;
    private final com.clenzy.repository.PrivacyRequestRepository privacyRequestRepository;
    private final com.clenzy.service.compliance.ObligationOwnership obligationOwnership;
    private final SupervisionSuggestionService suggestionService;
    private final java.time.Clock clock;
    private final com.clenzy.service.regulatory.NightsCapService nightsCapService;
    private final com.clenzy.service.RegulatoryComplianceService regulatoryComplianceService;

    /** Carte « bientôt atteint » quand il reste au plus ce nombre de nuits. */
    static final int NIGHTS_CAP_NEAR_THRESHOLD = 15;

    public ComplianceScanner(GuestDeclarationRepository declarationRepository,
                             ManagementContractRepository contractRepository,
                             ContractSignatureService contractSignatureService,
                             com.clenzy.service.TouristTaxService touristTaxService,
                             com.clenzy.service.TaxFilingService taxFilingService,
                             com.clenzy.repository.PropertyRepository propertyRepository,
                             com.clenzy.repository.PropertyLicenseRepository propertyLicenseRepository,
                             com.clenzy.repository.PrivacyRequestRepository privacyRequestRepository,
                             com.clenzy.service.compliance.ObligationOwnership obligationOwnership,
                             SupervisionSuggestionService suggestionService,
                             java.time.Clock clock,
                             com.clenzy.service.regulatory.NightsCapService nightsCapService,
                             com.clenzy.service.RegulatoryComplianceService regulatoryComplianceService) {
        this.nightsCapService = nightsCapService;
        this.regulatoryComplianceService = regulatoryComplianceService;
        this.declarationRepository = declarationRepository;
        this.contractRepository = contractRepository;
        this.contractSignatureService = contractSignatureService;
        this.touristTaxService = touristTaxService;
        this.taxFilingService = taxFilingService;
        this.propertyRepository = propertyRepository;
        this.propertyLicenseRepository = propertyLicenseRepository;
        this.privacyRequestRepository = privacyRequestRepository;
        this.obligationOwnership = obligationOwnership;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue les règles pour un logement et émet les cartes HITL correspondantes. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            scanPoliceDeclarations(orgId, propertyId);
        } catch (Exception e) {
            log.debug("compliance police scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanUnsignedMandates(orgId, propertyId);
        } catch (Exception e) {
            log.debug("compliance mandate scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanTouristTaxDue(orgId, propertyId);
        } catch (Exception e) {
            log.debug("tourist tax scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanExpiringLicenses(orgId, propertyId);
        } catch (Exception e) {
            log.debug("license scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanNightsCap(orgId, propertyId);
        } catch (Exception e) {
            log.debug("nights cap scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanTouristTaxUndeclared(orgId, propertyId);
        } catch (Exception e) {
            log.debug("tourist tax declaration scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanFrRegistrationNumber(orgId, propertyId);
        } catch (Exception e) {
            log.debug("registration scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanGdprErasureRequests(orgId, propertyId);
        } catch (Exception e) {
            log.debug("gdpr scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * M9 — demandes d'effacement RGPD en attente : une carte par demande RECEIVED
     * avec l'échéance légale (J+30). Org-level (une seule ancre). La carte n'existe
     * que si un voyageur est rattaché — sans fiche liée, l'effacement n'a pas de
     * cible et la demande se traite depuis Réglages > Confidentialité.
     */
    private void scanGdprErasureRequests(Long orgId, Long propertyId) {
        if (!propertyId.equals(propertyRepository.findFirstPropertyIdByOrg(orgId))) {
            return; // une seule ancre org-level
        }
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
        for (com.clenzy.model.PrivacyRequest request : privacyRequestRepository
                .findByOrganizationIdAndTypeAndStatus(orgId,
                        com.clenzy.model.PrivacyRequest.Type.ERASURE,
                        com.clenzy.model.PrivacyRequest.Status.RECEIVED)) {
            if (request.getGuestId() == null) {
                suggestionService.record(orgId, propertyId, MODULE_CMP, "gdpr_unlinked",
                        "Demande d'effacement RGPD sans fiche voyageur (demande #" + request.getId() + ")",
                        "Demande de " + request.getRequesterEmail() + " reçue le "
                                + request.getRequestedAt() + " (échéance légale " + request.getDueAt()
                                + "). Lier la fiche voyageur dans Réglages > Confidentialité pour"
                                + " que l'effacement devienne exécutable.",
                        null, "warning");
                continue;
            }
            final long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(today, request.getDueAt());
            suggestionService.recordOrgActionable(orgId, propertyId, MODULE_CMP,
                    "Effacement RGPD à exécuter (demande #" + request.getId() + ")",
                    "Demande de " + request.getRequesterEmail() + " reçue le " + request.getRequestedAt()
                            + " — échéance légale le " + request.getDueAt()
                            + (daysLeft >= 0 ? " (J-" + daysLeft + ")" : " (DÉPASSÉE)")
                            + ". « Effacer » est IRRÉVERSIBLE : identité, coordonnées et messages"
                            + " purgés ; factures et fiches police conservées (obligations légales,"
                            + " rapport tracé sur la demande).",
                    SupervisionActionType.GDPR_ERASE,
                    "{\"requestId\":" + request.getId() + "}",
                    null, daysLeft <= 7 ? "critical" : "warning");
        }
    }

    /**
     * Plafond annuel de nuitées d'une résidence principale (France, L324-1-1 IV).
     *
     * <ul>
     *   <li>Reste ≤ {@value #NIGHTS_CAP_NEAR_THRESHOLD} nuits → carte INFO « bientôt atteint ».</li>
     *   <li>Plafond atteint, jours encore vendables → carte {@code NIGHTS_CAP_CLOSE}
     *       (« Fermer le calendrier »). La refuser est une DÉROGATION, notifiée.</li>
     *   <li>Plafond DÉPASSÉ (réservation d'un canal, impossible à refuser) → même carte en
     *       critique, et notification explicite des gestionnaires à sa création.</li>
     * </ul>
     *
     * <p>Les nuits comptées incluent les séjours à venir déjà réservés : c'est ce qui
     * sera loué, et c'est ce que la commune peut réclamer.</p>
     */
    private void scanNightsCap(Long orgId, Long propertyId) {
        final var cap = nightsCapService.activeCap(propertyId, orgId);
        if (cap.isEmpty()) {
            return;
        }
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
        final int year = today.getYear();
        final int max = cap.get();
        final int rented = regulatoryComplianceService.rentedNightsInYear(propertyId, orgId, year);
        final int remaining = max - rented;
        final String reachedTitle = "Plafond annuel de nuitées atteint (" + year + ")";
        final String exceededTitle = "Plafond annuel de nuitées dépassé (" + year + ")";
        final String nearTitle = "Plafond annuel de nuitées bientôt atteint (" + year + ")";

        if (remaining > 0) {
            // Condition levée (annulation, plafond relevé) : les cartes de fermeture n'ont plus d'objet.
            suggestionService.dismissObsolete(orgId, propertyId, MODULE_CMP, reachedTitle);
            suggestionService.dismissObsolete(orgId, propertyId, MODULE_CMP, exceededTitle);
            if (remaining <= NIGHTS_CAP_NEAR_THRESHOLD) {
                suggestionService.record(orgId, propertyId, MODULE_CMP, "nights_cap_near", nearTitle,
                        rented + " nuit(s) louée(s) sur " + max + " autorisées cette année : il en reste "
                                + remaining + ". Résidence principale louée en meublé de tourisme — "
                                + "Code du tourisme L324-1-1. Au-delà, l'agent Conformité proposera de "
                                + "fermer le calendrier jusqu'au 31 décembre.",
                        null, "info");
            }
            return;
        }
        if (nightsCapService.freeDaysRestOfYear(propertyId, orgId, today) == 0) {
            return; // déjà fermé : rien de vendable d'ici la fin de l'année
        }
        final boolean exceeded = rented > max;
        final boolean created = suggestionService.recordActionableStrict(orgId, propertyId, MODULE_CMP, null,
                exceeded ? exceededTitle : reachedTitle,
                (exceeded
                        ? rented + " nuits louées pour un plafond de " + max + " : une réservation importée d'un "
                                + "canal a dépassé le plafond (un canal ne peut pas être refusé). "
                        : rented + " nuits louées sur " + max + " autorisées : le plafond est atteint. ")
                        + "« Fermer le calendrier » rend les nuits libres invendables jusqu'au 31 décembre sur "
                        + "tous les canaux. Refuser cette carte revient à déroger au plafond légal : les "
                        + "gestionnaires en seront prévenus.",
                SupervisionActionType.NIGHTS_CAP_CLOSE, "{}", null, exceeded ? "critical" : "warning");
        if (created && exceeded) {
            final String name = propertyRepository.findNameByIdAndOrgId(propertyId, orgId).orElse(null);
            nightsCapService.notifyChannelOverrun(orgId, propertyId, name, null,
                    rented + " nuits louées en " + year + " pour un plafond de " + max);
        }
    }

    /**
     * Taxe de séjour jamais déclarée (France, Maroc) : ni barème propre au logement, ni
     * barème par défaut de l'organisation. Les logements créés depuis le 2026-10-02 la
     * déclarent à la création ; ceux d'avant reçoivent cette carte. Sans barème, rien n'est
     * collecté — et c'est l'exploitant qui doit la taxe à la commune.
     */
    private void scanTouristTaxUndeclared(Long orgId, Long propertyId) {
        final var property = propertyRepository.findByIdWithOwner(propertyId, orgId).orElse(null);
        if (property == null || property.getCountryCode() == null) {
            return;
        }
        final String country = property.getCountryCode().trim().toUpperCase(java.util.Locale.ROOT);
        if (!"FR".equals(country) && !"MA".equals(country) && !"SA".equals(country)) {
            return;
        }
        if (touristTaxService.getConfigForProperty(propertyId, orgId).isPresent()
                || touristTaxService.resolveConfig(propertyId, orgId).isPresent()) {
            return;
        }
        suggestionService.record(orgId, propertyId, MODULE_CMP, "tourist_tax_undeclared",
                "Taxe de séjour à déclarer pour ce logement",
                "Aucun barème de taxe de séjour ne s'applique à ce logement : elle n'est ni calculée ni "
                        + "collectée. Déclarez le montant (ou l'absence de taxe dans la commune) dans "
                        + "Réglages › Fiscal › Barèmes de taxe de séjour — le référentiel officiel propose "
                        + "un tarif, à confirmer."
                        + ("MA".equals(country)
                                ? " Au Maroc, les plateformes ne la collectent pas : l'hôte la reverse chaque trimestre."
                                : "SA".equals(country)
                                ? " En Arabie saoudite, c'est la redevance municipale d'occupation (2,5 %, ou 5 % en "
                                        + "4 étoiles et plus), déclarée chaque mois sur Balady."
                                : ""),
                null, "warning");
    }

    /**
     * Numéro d'enregistrement d'un meublé de tourisme en France (Code du tourisme
     * L324-1-1) : obligatoire sur toute annonce, généralisé à toutes les communes par la
     * loi du 19 novembre 2024. Absent ou faux → carte INFO : l'enregistrement est un acte
     * en mairie (téléservice), aucun bouton ne peut le faire à la place de l'exploitant.
     * Chambre d'hôtes exclue (déclaration distincte).
     */
    private void scanFrRegistrationNumber(Long orgId, Long propertyId) {
        final var property = propertyRepository.findByIdWithOwner(propertyId, orgId).orElse(null);
        if (property == null
                || !com.clenzy.service.regulatory.FrRegulatoryProfileService.isRegistrationRequired(property)) {
            return;
        }
        final String number = propertyLicenseRepository
                .findFirstByPropertyIdAndOrganizationIdAndLicenseType(propertyId, orgId,
                        com.clenzy.model.PropertyLicense.LicenseType.TOURISM_REGISTRATION)
                .map(com.clenzy.model.PropertyLicense::getLicenseNumber)
                .orElse(null);
        final var verdict = com.clenzy.service.property.TourismLicense.check(
                property.getCountryCode(), number, property.getCommuneInseeCode());
        if (verdict == com.clenzy.service.property.TourismLicense.Verdict.VALID) {
            return;
        }
        final boolean absent = verdict == com.clenzy.service.property.TourismLicense.Verdict.ABSENT;
        suggestionService.record(orgId, propertyId, MODULE_CMP, "registration_missing",
                absent ? "Numéro d'enregistrement en mairie manquant"
                        : "Numéro d'enregistrement en mairie à corriger",
                (absent
                        ? "Ce meublé de tourisme n'a pas de numéro d'enregistrement. "
                        : "Le numéro saisi ne correspond pas au format national ou à la commune du logement. ")
                        + "Il est obligatoire sur toute annonce (Code du tourisme L324-1-1) et s'obtient "
                        + "auprès de la mairie ou du téléservice national. Saisissez-le dans la fiche du "
                        + "logement › Conformité : il sera repris sur les annonces.",
                null, "warning");
    }

    /**
     * Licences arrivant à échéance (M1, vague M-A) : {@code expires_at − lead ≤ today}
     * → carte INFO warning (le renouvellement est un acte administratif externe — pas
     * de bouton tant qu'aucun portail de dépôt n'est branché). L'échéance dans
     * l'intitulé rend la dédup naturelle : une nouvelle échéance = une nouvelle carte.
     */
    private void scanExpiringLicenses(Long orgId, Long propertyId) {
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
        // Licence détenue par le propriétaire : la conciergerie ne peut pas la
        // renouveler, elle peut prévenir. Le texte change, pas la vigilance.
        final boolean orgHolds = obligationOwnership.orgBears(
                orgId, propertyId, ObligationOwnership.Obligation.LICENCE);
        for (com.clenzy.model.PropertyLicense license : propertyLicenseRepository
                .findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(propertyId, orgId)) {
            if (license.getExpiresAt() == null
                    || license.getExpiresAt().minusDays(license.getRenewalLeadDays()).isAfter(today)) {
                continue;
            }
            final boolean expired = license.getExpiresAt().isBefore(today);
            final String label = switch (license.getLicenseType()) {
                case SHORT_TERM_RENTAL -> "Licence courte durée";
                case TOURISM_REGISTRATION -> "Enregistrement touristique";
                case SAFETY_CERT -> "Certificat de sécurité";
                case OTHER -> "Autorisation";
            };
            suggestionService.record(orgId, propertyId, MODULE_CMP, "license_expiring",
                    label + (expired ? " EXPIRÉE depuis le " : " expire le ")
                            + license.getExpiresAt()
                            + (license.getLicenseNumber() != null
                                ? " (n° " + license.getLicenseNumber() + ")" : ""),
                    orgHolds
                            ? "Le renouvellement est à déposer auprès de "
                                    + (license.getIssuedBy() != null ? license.getIssuedBy() : "l'autorité émettrice")
                                    + ". Sans licence valide, l'annonce peut être retirée des canaux — "
                                    + "mettre à jour l'échéance dans la fiche du logement une fois renouvelée."
                            : "La licence est détenue par le propriétaire selon le mandat de gestion : "
                                    + "le renouvellement lui revient. Sans licence valide, l'annonce peut "
                                    + "être retirée des canaux — le prévenir dès maintenant.");
        }
    }

    /**
     * Taxe de séjour du trimestre écoulé (vague C) — carte INFO org-level (ancrée sur
     * le plus petit logement), proposée les {@value #TAX_REMINDER_WINDOW_DAYS} premiers
     * jours du nouveau trimestre. Pas de bouton « Télédéclarer » : aucun canal de
     * télédéclaration n'est branché — la carte porte le montant calculé et renvoie au
     * rapport, elle ne prétend rien déposer.
     */
    private void scanTouristTaxDue(Long orgId, Long propertyId) {
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
        final int dayOfQuarter = today.getDayOfYear()
                - today.withMonth(((today.getMonthValue() - 1) / 3) * 3 + 1).withDayOfMonth(1).getDayOfYear();
        if (dayOfQuarter >= TAX_REMINDER_WINDOW_DAYS) {
            return;
        }
        if (!propertyId.equals(propertyRepository.findFirstPropertyIdByOrg(orgId))) {
            return; // une seule ancre org-level
        }
        final java.time.LocalDate quarterStart = today
                .withMonth(((today.getMonthValue() - 1) / 3) * 3 + 1).withDayOfMonth(1);
        final java.time.LocalDate prevQuarterStart = quarterStart.minusMonths(3);
        final java.time.LocalDate prevQuarterEnd = quarterStart.minusDays(1);
        final var report = touristTaxService.computeForPeriod(orgId, prevQuarterStart, prevQuarterEnd);
        if (report == null || report.lines() == null || report.lines().isEmpty()) {
            return; // rien de taxable sur le trimestre
        }

        // Ventilation PAR LOGEMENT : c'est lui qui porte la commune (donc l'autorité
        // à qui l'on dépose), le barème dérogatoire, et le mandat déclaratif. Un
        // total d'organisation mélangeait des communes qui ne se déclarent ni au
        // même endroit ni au même calendrier.
        final java.util.Map<Long, java.math.BigDecimal> byProperty = new java.util.LinkedHashMap<>();
        final java.util.Map<Long, String> communeOf = new java.util.HashMap<>();
        for (var line : report.lines()) {
            // Taxe collectée par la plateforme : elle la reverse elle-même, l'hôte ne la déclare pas.
            if (line.propertyId() == null || line.taxAmount() == null || line.collectedByPlatform()) {
                continue;
            }
            byProperty.merge(line.propertyId(), line.taxAmount(), java.math.BigDecimal::add);
            if (line.communeName() != null) {
                communeOf.putIfAbsent(line.propertyId(), line.communeName());
            }
        }

        // Une carte par COMMUNE : c'est l'acte réel (« j'ai déposé à Marrakech »),
        // et chaque commune porte les identifiants de déclaration de ses logements.
        final java.util.Map<String, java.util.List<Long>> filingsByCommune = new java.util.LinkedHashMap<>();
        final java.util.Map<String, java.math.BigDecimal> totalByCommune = new java.util.LinkedHashMap<>();
        for (var entry : byProperty.entrySet()) {
            final Long taxedPropertyId = entry.getKey();
            if (entry.getValue().signum() <= 0) {
                continue;
            }
            // Le mandat peut laisser la taxe au propriétaire : elle sort alors du
            // périmètre déclaratif de la conciergerie — et de son total.
            if (!obligationOwnership.orgBears(orgId, taxedPropertyId,
                    ObligationOwnership.Obligation.TOURIST_TAX)) {
                continue;
            }
            final com.clenzy.model.TaxFiling filing = taxFilingService.ensureDueFiling(
                    orgId, taxedPropertyId, prevQuarterStart, prevQuarterEnd, entry.getValue(), "EUR");
            if (filing.getStatus() != com.clenzy.model.TaxFiling.Status.DUE) {
                continue; // déjà déposée/payée pour ce logement
            }
            final String commune = communeOf.getOrDefault(taxedPropertyId, "commune non renseignée");
            filingsByCommune.computeIfAbsent(commune, k -> new java.util.ArrayList<>()).add(filing.getId());
            totalByCommune.merge(commune, filing.getAmount(), java.math.BigDecimal::add);
        }
        if (filingsByCommune.isEmpty()) {
            return;
        }

        final int quarter = ((prevQuarterStart.getMonthValue() - 1) / 3) + 1;
        for (var commune : filingsByCommune.entrySet()) {
            final java.math.BigDecimal total = totalByCommune.get(commune.getKey());
            final String ids = commune.getValue().stream().map(String::valueOf)
                    .collect(java.util.stream.Collectors.joining(","));
            suggestionService.recordOrgActionable(orgId, propertyId, MODULE_CMP,
                    "Taxe de séjour T" + quarter + " " + prevQuarterStart.getYear()
                            + " — " + commune.getKey() + " : " + total + " EUR",
                    "Trimestre " + prevQuarterStart + " → " + prevQuarterEnd + " clôturé pour "
                            + commune.getValue().size() + " logement(s) de " + commune.getKey()
                            + ", " + total + " EUR calculés (exonérations déduites, détail dans "
                            + "Rapports > Taxe de séjour). Après votre dépôt auprès de la commune, "
                            + "« Marquer déclarée » trace le dépôt au registre — rien n'est "
                            + "télédéclaré automatiquement.",
                    SupervisionActionType.TAX_MARK_FILED,
                    "{\"filingIds\":[" + ids + "]}",
                    total.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact(),
                    "info");
        }
    }

    private void scanPoliceDeclarations(Long orgId, Long propertyId) {
        // France exclue : la fiche y est conservée, jamais télédéclarée (CESEDA R814-3) —
        // proposer « Télédéclarer » inviterait à un geste qui n'existe pas.
        final List<GuestDeclaration> submittable = declarationRepository
                .findSubmittableByProperty(orgId, propertyId, DeclarationStatus.COMPLETED)
                .stream()
                .filter(d -> !"FR".equalsIgnoreCase(d.getCountryCode()) && !d.isExempt())
                .toList();
        // Qui déclare ? Le mandat le dit (défaut : l'exploitant). Quand le
        // propriétaire déclare, la conciergerie ne peut PAS le faire à sa place —
        // ses identifiants de téléservice ne l'engagent pas. Le geste qui lui
        // reste est la relance, et c'est celui qu'on lui propose.
        final boolean orgDeclares = obligationOwnership.orgBears(
                orgId, propertyId, ObligationOwnership.Obligation.POLICE_DECLARATION);
        // Une carte par RÉSERVATION (l'apply soumet toutes les fiches complétées du séjour).
        submittable.stream()
                .map(d -> d.getReservation())
                .filter(r -> r != null && r.getId() != null)
                .distinct()
                .forEach(reservation -> {
                    if (orgDeclares) {
                        suggestionService.recordActionableStrict(
                                orgId, propertyId, MODULE_CMP, reservation.getId(),
                                "Fiche police à télédéclarer (réservation #" + reservation.getId() + ")",
                                "Fiche(s) voyageur complétée(s) mais pas encore déposée(s) auprès de "
                                        + "l'autorité. « Télédéclarer » soumet toutes les fiches complétées "
                                        + "du séjour via le canal configuré.",
                                SupervisionActionType.POLICE_DECLARE,
                                "{\"reservationId\":" + reservation.getId() + "}", null, "warning");
                    } else {
                        suggestionService.record(orgId, propertyId, MODULE_CMP, "police_owner_bears",
                                "Fiche police à faire déposer par le propriétaire (réservation #"
                                        + reservation.getId() + ")",
                                "Le mandat de gestion laisse la télédéclaration au propriétaire : "
                                        + "vos identifiants de téléservice ne l'engagent pas. Les fiches "
                                        + "sont complétées et prêtes — il reste à le relancer.",
                                reservation.getId(), "warning");
                    }
                });
    }

    private void scanUnsignedMandates(Long orgId, Long propertyId) {
        final List<ManagementContract> drafts = contractRepository
                .findByPropertyId(propertyId, orgId).stream()
                .filter(c -> c.getStatus() == ManagementContract.ContractStatus.DRAFT)
                .toList();
        if (drafts.isEmpty()) {
            return;
        }
        final Map<Long, String> signatureStatuses = contractSignatureService
                .signatureStatusByContractIds(drafts.stream().map(ManagementContract::getId).toList());
        for (ManagementContract contract : drafts) {
            if (signatureStatuses.containsKey(contract.getId())) {
                continue; // demande déjà émise (en attente, signée ou expirée)
            }
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_CMP,
                    "Mandat de gestion à envoyer en signature (#" + contract.getId() + ")",
                    "Le mandat est prêt mais aucune demande de signature n'est partie. "
                            + "« Envoyer pour signature » génère le document si besoin et adresse "
                            + "le lien de signature électronique au propriétaire.",
                    SupervisionActionType.MANDATE_SIGN_SEND,
                    "{\"contractId\":" + contract.getId() + "}", null, "info");
        }
    }
}
