package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.InterventionProofDto;
import com.clenzy.model.ActionItem;
import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.InterventionPhotoService;
import com.clenzy.service.PropertyTeamService;
import com.clenzy.service.payout.HousekeeperPayoutService;
import com.clenzy.util.InterventionTypeMatcher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ce que la carte doit montrer avant qu'on agisse sur une intervention.
 *
 * <p>Deux lectures, aucun effet : les équipes qui peuvent la prendre, et les
 * photos qui conditionnent le paiement du prestataire. Elles précèdent des
 * gestes irréversibles — assigner, attester que le travail a eu lieu — et
 * n'existent que pour qu'on ne les fasse pas à l'aveugle.</p>
 */
@Service
@Transactional(readOnly = true)
public class InterventionActionContextService {

    private final ActionItemLoader loader;
    private final InterventionRepository interventionRepository;
    private final PropertyTeamService propertyTeamService;
    private final InterventionPhotoService interventionPhotoService;
    private final HousekeeperPayoutService housekeeperPayoutService;

    public InterventionActionContextService(ActionItemLoader loader,
                                            InterventionRepository interventionRepository,
                                            PropertyTeamService propertyTeamService,
                                            InterventionPhotoService interventionPhotoService,
                                            HousekeeperPayoutService housekeeperPayoutService) {
        this.loader = loader;
        this.interventionRepository = interventionRepository;
        this.propertyTeamService = propertyTeamService;
        this.interventionPhotoService = interventionPhotoService;
        this.housekeeperPayoutService = housekeeperPayoutService;
    }

    /**
     * Équipes qui peuvent prendre cette intervention à sa date.
     *
     * <p>La suggestion vient du même mécanisme que les prestations : il ne
     * dépend que d'un logement et d'une date, pas du type d'objet. Les équipes
     * couvrant la zone sont proposées même quand elles sont occupées — une liste
     * vide ferait croire qu'il n'existe personne, ce qui est faux et bloque.</p>
     */
    public PropertyTeamService.AssignableTeams assignableTeams(Long actionItemId, Long orgId) {
        final Intervention intervention = requireIntervention(actionItemId, orgId,
                ActionItemKind.INTERVENTION_UNASSIGNED,
                "Cette action ne se resout pas par une assignation");

        // Le type requis accompagne toujours la reponse : c'est quand la liste
        // est vide qu'il compte, et c'est la que l'ecran n'avait rien a dire.
        return new PropertyTeamService.AssignableTeams(
                propertyTeamService.findAssignableTeams(
                        intervention.getProperty() == null ? null : intervention.getProperty().getId(),
                        intervention.getScheduledDate(),
                        intervention.getEstimatedDurationHours(),
                        intervention.getType(),
                        orgId),
                InterventionTypeMatcher.requiredTeamType(intervention.getType()));
    }

    /**
     * Les photos de fin de mission de l'intervention que cette action signale.
     *
     * <p>Elles conditionnent le paiement du prestataire. Les montrer avant le
     * geste transforme « Terminer déclenche le paiement » en quelque chose de
     * vérifiable : on voit ce qu'on atteste, ou l'on constate qu'il n'y a rien à
     * attester.</p>
     */
    public InterventionProofDto interventionProof(Long actionItemId, Long orgId) {
        final Intervention intervention = requireIntervention(actionItemId, orgId,
                ActionItemKind.INTERVENTION_OVERDUE,
                "Cette action ne porte pas d'intervention");

        return new InterventionProofDto(
                interventionPhotoService.convertPhotosToBase64UrlsByType(intervention, "after"),
                housekeeperPayoutService.isProofComplete(intervention));
    }

    private Intervention requireIntervention(Long actionItemId, Long orgId,
                                             ActionItemKind expected, String refusal) {
        final ActionItem item = loader.loadOfKind(actionItemId, orgId, expected, refusal);
        return interventionRepository.findById(item.getTargetId())
                .filter(i -> orgId.equals(i.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Intervention introuvable"));
    }
}
