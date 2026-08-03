package com.clenzy.service.agent.supervision;

import com.clenzy.model.DeclarationStatus;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.ManagementContract;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.ManagementContractRepository;
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
    private final SupervisionSuggestionService suggestionService;
    private final java.time.Clock clock;

    public ComplianceScanner(GuestDeclarationRepository declarationRepository,
                             ManagementContractRepository contractRepository,
                             ContractSignatureService contractSignatureService,
                             com.clenzy.service.TouristTaxService touristTaxService,
                             com.clenzy.service.TaxFilingService taxFilingService,
                             com.clenzy.repository.PropertyRepository propertyRepository,
                             com.clenzy.repository.PropertyLicenseRepository propertyLicenseRepository,
                             SupervisionSuggestionService suggestionService,
                             java.time.Clock clock) {
        this.declarationRepository = declarationRepository;
        this.contractRepository = contractRepository;
        this.contractSignatureService = contractSignatureService;
        this.touristTaxService = touristTaxService;
        this.taxFilingService = taxFilingService;
        this.propertyRepository = propertyRepository;
        this.propertyLicenseRepository = propertyLicenseRepository;
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
    }

    /**
     * Licences arrivant à échéance (M1, vague M-A) : {@code expires_at − lead ≤ today}
     * → carte INFO warning (le renouvellement est un acte administratif externe — pas
     * de bouton tant qu'aucun portail de dépôt n'est branché). L'échéance dans
     * l'intitulé rend la dédup naturelle : une nouvelle échéance = une nouvelle carte.
     */
    private void scanExpiringLicenses(Long orgId, Long propertyId) {
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
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
                    "Le renouvellement est à déposer auprès de "
                            + (license.getIssuedBy() != null ? license.getIssuedBy() : "l'autorité émettrice")
                            + ". Sans licence valide, l'annonce peut être retirée des canaux — "
                            + "mettre à jour l'échéance dans la fiche du logement une fois renouvelée.");
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
        final var report = touristTaxService.computeForPeriod(
                orgId, prevQuarterStart, quarterStart.minusDays(1));
        if (report == null || report.totalTax() == null || report.totalTax().signum() <= 0) {
            return; // rien de taxable sur le trimestre
        }
        // Registre (M2) : l'entrée DUE du trimestre est créée (idempotent, unique
        // org+période) ; la carte ne se lève que tant qu'elle n'est pas déposée.
        final com.clenzy.model.TaxFiling filing = taxFilingService.ensureDueFiling(
                orgId, prevQuarterStart, quarterStart.minusDays(1), report.totalTax(), "EUR");
        if (filing.getStatus() != com.clenzy.model.TaxFiling.Status.DUE) {
            return; // déjà déposée/payée
        }
        final int quarter = ((prevQuarterStart.getMonthValue() - 1) / 3) + 1;
        suggestionService.recordActionable(orgId, propertyId, MODULE_CMP,
                "Taxe de séjour T" + quarter + " " + prevQuarterStart.getYear()
                        + " : " + filing.getAmount() + " " + filing.getCurrency(),
                "Trimestre " + prevQuarterStart + " → " + quarterStart.minusDays(1)
                        + " clôturé, " + filing.getAmount() + " " + filing.getCurrency()
                        + " calculés (exonérations déduites, détail dans Rapports > Taxe de "
                        + "séjour). Après votre dépôt auprès de l'autorité, « Marquer déclarée » "
                        + "trace le dépôt au registre — rien n'est télédéclaré automatiquement.",
                SupervisionActionType.TAX_MARK_FILED,
                "{\"filingId\":" + filing.getId() + "}",
                filing.getAmount().movePointRight(2)
                        .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact(),
                "info");
    }

    private void scanPoliceDeclarations(Long orgId, Long propertyId) {
        final List<GuestDeclaration> submittable = declarationRepository
                .findSubmittableByProperty(orgId, propertyId, DeclarationStatus.COMPLETED);
        // Une carte par RÉSERVATION (l'apply soumet toutes les fiches complétées du séjour).
        submittable.stream()
                .map(d -> d.getReservation())
                .filter(r -> r != null && r.getId() != null)
                .distinct()
                .forEach(reservation -> suggestionService.recordActionableStrict(
                        orgId, propertyId, MODULE_CMP, reservation.getId(),
                        "Fiche police à télédéclarer (réservation #" + reservation.getId() + ")",
                        "Fiche(s) voyageur complétée(s) mais pas encore déposée(s) auprès de "
                                + "l'autorité. « Télédéclarer » soumet toutes les fiches complétées "
                                + "du séjour via le canal configuré.",
                        SupervisionActionType.POLICE_DECLARE,
                        "{\"reservationId\":" + reservation.getId() + "}", null, "warning"));
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
