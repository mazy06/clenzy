package com.clenzy.repository;

import com.clenzy.model.ServiceRequest;
import java.util.Optional;
import java.time.LocalDateTime;

public interface ServiceRequestMutationRepository {
    /** Verrou jusqu'au commit et relecture, même si la session contient déjà la demande. */
    Optional<ServiceRequest> findForMutation(Long id);

    /** Verrouille la cible jusqu'au commit et vérifie les réservations, toutes organisations. */
    boolean assignmentConflicts(Long requestId, String targetType, Long targetId,
                                LocalDateTime start, Integer durationHours);

    boolean interventionAssignmentConflicts(Long requestId, Long interventionId, String targetType,
                                            Long targetId, LocalDateTime start, Integer durationHours);

    /** Aperçu sans verrou ni réservation ; la commande doit recontrôler sous verrou. */
    boolean previewAssignmentConflicts(Long requestId, Long interventionId, String targetType,
                                       Long targetId, LocalDateTime start, Integer durationHours);

    Optional<com.clenzy.model.Team> findTeamForCompositionMutation(Long id);
    boolean teamHasActiveAssignments(Long id);

    /** Sérialise les modifications de disponibilités avec les attributions de cette équipe. */
    void lockTeamAvailability(Long teamId);
    /** Même verrou pour une prestation asynchrone, sans réserver un créneau. */
    void lockAssignee(String kind, Long id);
}
