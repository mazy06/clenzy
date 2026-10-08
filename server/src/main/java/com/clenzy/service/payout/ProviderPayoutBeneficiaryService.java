package com.clenzy.service.payout;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PayoutBeneficiary;
import com.clenzy.model.ProviderPayoutBeneficiary;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/** La plateforme confirme le bénéficiaire légal ; ni le client ni un membre d'équipe ne fournit de compte PSP. */
@Service
@Transactional(readOnly = true)
public class ProviderPayoutBeneficiaryService {
    public record Recipient(PayoutBeneficiary beneficiary, String notificationSubject) {}
    public record Choice(Long organizationId, String organizationName, boolean selected, boolean locked,
                         Instant selectedAt) {}
    /** Identité de l'affectation réellement présentée à l'opérateur, sans compte PSP fourni par le client. */
    public record Review(Long missionId, Long propertyId, Long organizationId,
                         Long assignedUserId, Long teamId, Long recipientUserId) {}
    public record Selected(Long missionId, Long organizationId, Long propertyId) {}
    private final ProviderPayoutBeneficiaryRepository beneficiaries;
    private final HousekeeperPayoutRecordRepository records;
    private final UserRepository users;
    private final org.springframework.context.ApplicationEventPublisher events;

    public ProviderPayoutBeneficiaryService(ProviderPayoutBeneficiaryRepository beneficiaries,
            HousekeeperPayoutRecordRepository records, UserRepository users,
            org.springframework.context.ApplicationEventPublisher events) {
        this.beneficiaries = beneficiaries; this.records = records; this.users = users;
        this.events = events;
    }

    public Optional<Review> review(Long missionId, Long orgId) {
        var assignment = assignment(missionId, orgId);
        if ("CANCELLED".equals(assignment.getStatus()) || assignment.getRecipientOrganizationId() == null
                || (assignment.getAssignedUserId() == null && assignment.getTeamId() == null)
                || choice(missionId, orgId).locked()) return Optional.empty();
        return Optional.of(new Review(missionId, assignment.getPropertyId(), assignment.getRecipientOrganizationId(),
                assignment.getAssignedUserId(), assignment.getTeamId(), assignment.getRecipientUserId()));
    }

    @Transactional
    public Choice selectReviewedOrganization(Long orgId, Review expected, String actorSubject) {
        beneficiaries.lockMission(expected.missionId());
        beneficiaries.lockAssignment(expected.missionId(), orgId);
        var current = review(expected.missionId(), orgId)
                .orElseThrow(() -> new IllegalStateException("Le bénéficiaire n'est plus à valider. Actualisez la constellation."));
        if (!current.equals(expected))
            throw new IllegalStateException("L'affectation a changé. Examinez la nouvelle proposition avant de valider.");
        return selectOrganization(expected.missionId(), orgId, expected.organizationId(), actorSubject);
    }

    public Choice choice(Long missionId, Long orgId) {
        var assignment = assignment(missionId, orgId);
        var selected = beneficiaries.findByInterventionIdAndOrganizationId(missionId, orgId);
        selected.ifPresent(value -> requireSameAssignment(value, assignment));
        return new Choice(assignment.getRecipientOrganizationId(), assignment.getOrganizationName(),
                selected.isPresent(), selected.isPresent() || records.findByInterventionId(missionId).isPresent(),
                selected.map(ProviderPayoutBeneficiary::getSelectedAt).orElse(null));
    }

    @Transactional
    public Choice selectOrganization(Long missionId, Long orgId, Long expectedOrgId, String actorSubject) {
        beneficiaries.lockMission(missionId);
        beneficiaries.lockAssignment(missionId, orgId);
        var assignment = assignment(missionId, orgId);
        if ("CANCELLED".equals(assignment.getStatus()))
            throw new IllegalStateException("Une mission annulée ne peut plus recevoir de bénéficiaire.");
        if (expectedOrgId == null || !expectedOrgId.equals(assignment.getRecipientOrganizationId())) {
            throw new IllegalArgumentException("L'organisation choisie ne correspond pas au prestataire affecté.");
        }
        var existing = beneficiaries.findByInterventionIdAndOrganizationId(missionId, orgId);
        if (existing.isPresent()) {
            requireSameAssignment(existing.get(), assignment);
            return choice(missionId, orgId);
        }
        if (records.findByInterventionId(missionId).isPresent()) {
            throw new IllegalStateException("Le bénéficiaire est figé par un versement existant. Rapprochement requis.");
        }
        var actor = users.findByKeycloakId(actorSubject).orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
        beneficiaries.saveAndFlush(new ProviderPayoutBeneficiary(missionId, orgId, expectedOrgId,
                assignment.getAssignedUserId(), assignment.getTeamId(), actor.getId()));
        events.publishEvent(new Selected(missionId, orgId, assignment.getPropertyId()));
        return choice(missionId, orgId);
    }

    public Optional<Recipient> resolve(Long missionId, Long orgId) {
        var assignment = assignment(missionId, orgId);
        var selected = beneficiaries.findByInterventionIdAndOrganizationId(missionId, orgId);
        if (selected.isPresent()) {
            requireSameAssignment(selected.get(), assignment);
            return Optional.of(new Recipient(PayoutBeneficiary.organization(selected.get().getBeneficiaryOrganizationId()), null));
        }
        if (assignment.getRecipientUserId() == null) return Optional.empty();
        return Optional.of(new Recipient(PayoutBeneficiary.user(assignment.getRecipientUserId()), assignment.getNotificationSubject()));
    }

    /** Partage impérativement la transaction de préparation du versement. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void lockAndRequireRecipient(Long missionId, Long orgId, PayoutBeneficiary expected) {
        beneficiaries.lockMission(missionId);
        var current = resolve(missionId, orgId).orElseThrow(() -> new IllegalStateException("Bénéficiaire à désigner."));
        if (!current.beneficiary().equals(expected)) throw new IllegalStateException("Le bénéficiaire a changé. Rapprochement requis.");
    }

    private ProviderPayoutBeneficiaryRepository.Assignment assignment(Long missionId, Long orgId) {
        var assignment = beneficiaries.findAssignment(missionId, orgId)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        if (assignment.getAssignedUserId() != null && assignment.getTeamId() != null)
            throw new IllegalStateException("Affectation ambiguë, bénéficiaire à vérifier.");
        return assignment;
    }

    private void requireSameAssignment(ProviderPayoutBeneficiary selected, ProviderPayoutBeneficiaryRepository.Assignment assignment) {
        if (!Objects.equals(selected.getAssignedUserId(), assignment.getAssignedUserId())
                || !Objects.equals(selected.getTeamId(), assignment.getTeamId())
                || !Objects.equals(selected.getBeneficiaryOrganizationId(), assignment.getRecipientOrganizationId())) {
            throw new IllegalStateException("L'affectation a changé depuis la désignation du bénéficiaire. Rapprochement requis.");
        }
    }
}
