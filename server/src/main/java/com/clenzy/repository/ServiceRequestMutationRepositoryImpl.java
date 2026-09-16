package com.clenzy.repository;

import com.clenzy.model.ServiceRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.TreeSet;

public class ServiceRequestMutationRepositoryImpl implements ServiceRequestMutationRepository {
    private final EntityManager entityManager;

    public ServiceRequestMutationRepositoryImpl(EntityManager entityManager) { this.entityManager = entityManager; }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<ServiceRequest> findForMutation(Long id) {
        // Les créations/replanifications du même flux sont persistées avant relecture.
        // Une écriture déjà périmée échoue ici, avant la décision et ses notifications.
        entityManager.flush();
        var request = entityManager.find(ServiceRequest.class, id);
        if (request == null) return Optional.empty();
        // find(..., PESSIMISTIC_WRITE) seul ne rafraîchit pas le cache de premier niveau.
        entityManager.refresh(request, LockModeType.PESSIMISTIC_WRITE);
        return Optional.of(request);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean assignmentConflicts(Long requestId, String targetType, Long targetId,
                                       LocalDateTime start, Integer durationHours) {
        return interventionAssignmentConflicts(requestId, null, targetType, targetId, start, durationHours);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean interventionAssignmentConflicts(Long requestId, Long interventionId, String targetType,
                                                   Long targetId, LocalDateTime start, Integer durationHours) {
        if (start == null || targetId == null || targetId <= 0
                || !("team".equals(targetType) || "user".equals(targetType))) {
            throw new IllegalArgumentException("Une cible et un créneau valides sont requis");
        }
        var keys = new TreeSet<String>();
        if ("team".equals(targetType)) {
            // Stabiliser la composition AVANT de lire les membres à verrouiller.
            lockResource("baitly:assignment:team:" + targetId);
            for (Object member : entityManager.createNativeQuery("SELECT user_id FROM team_members WHERE team_id = :team")
                    .setParameter("team", targetId).getResultList()) {
                keys.add("baitly:assignment:user:" + ((Number) member).longValue());
            }
        } else {
            keys.add("baitly:assignment:user:" + targetId);
        }
        // Même ordre pour les équipes partageant plusieurs membres. Les verrous sont
        // transactionnels, inter-processus, et ne portent aucune donnée personnelle.
        for (String key : keys) {
            lockResource(key);
        }
        entityManager.flush();
        return previewAssignmentConflicts(requestId, interventionId, targetType, targetId, start, durationHours);
    }

    @Override
    @Transactional(readOnly = true, propagation = Propagation.MANDATORY)
    public boolean previewAssignmentConflicts(Long requestId, Long interventionId, String targetType,
                                              Long targetId, LocalDateTime start, Integer durationHours) {
        var query = entityManager.createNativeQuery(
                "SELECT baitly_assignment_conflicts(:requestId, :interventionId, :targetType, :targetId, :start, :finish)");
        return Boolean.TRUE.equals(query.setParameter("requestId", requestId == null ? 0L : requestId)
                .setParameter("interventionId", interventionId == null ? 0L : interventionId)
                .setParameter("targetType", targetType).setParameter("targetId", targetId)
                .setParameter("start", start)
                .setParameter("finish", start.plusHours(durationHours != null && durationHours > 0 ? durationHours : 4))
                .getSingleResult());
    }

    private void lockResource(String key) {
        entityManager.createNativeQuery("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(:key, 0))")
                .setParameter("key", key).getSingleResult();
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockTeamAvailability(Long teamId) {
        if (teamId == null || teamId <= 0) throw new IllegalArgumentException("Équipe invalide");
        lockResource("baitly:assignment:team:" + teamId);
        // Même ordre que l'attribution : équipe, puis membres triés.
        var keys = new TreeSet<String>();
        for (Object member : entityManager.createNativeQuery("SELECT user_id FROM team_members WHERE team_id = :team")
                .setParameter("team", teamId).getResultList()) {
            keys.add("baitly:assignment:user:" + ((Number) member).longValue());
        }
        for (String key : keys) lockResource(key);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<com.clenzy.model.Team> findTeamForCompositionMutation(Long id) {
        lockResource("baitly:assignment:team:" + id);
        entityManager.flush();
        var team = entityManager.find(com.clenzy.model.Team.class, id);
        if (team != null) entityManager.refresh(team, LockModeType.PESSIMISTIC_WRITE);
        return Optional.ofNullable(team);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean teamHasActiveAssignments(Long id) {
        return Boolean.TRUE.equals(entityManager.createNativeQuery("SELECT baitly_team_has_active_assignments(:id)")
                .setParameter("id", id).getSingleResult());
    }
}
