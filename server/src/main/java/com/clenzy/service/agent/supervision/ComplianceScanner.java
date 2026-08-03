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

    private final GuestDeclarationRepository declarationRepository;
    private final ManagementContractRepository contractRepository;
    private final ContractSignatureService contractSignatureService;
    private final SupervisionSuggestionService suggestionService;

    public ComplianceScanner(GuestDeclarationRepository declarationRepository,
                             ManagementContractRepository contractRepository,
                             ContractSignatureService contractSignatureService,
                             SupervisionSuggestionService suggestionService) {
        this.declarationRepository = declarationRepository;
        this.contractRepository = contractRepository;
        this.contractSignatureService = contractSignatureService;
        this.suggestionService = suggestionService;
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
