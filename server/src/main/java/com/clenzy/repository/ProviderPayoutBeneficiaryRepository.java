package com.clenzy.repository;

import com.clenzy.model.ProviderPayoutBeneficiary;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ProviderPayoutBeneficiaryRepository extends JpaRepository<ProviderPayoutBeneficiary, Long> {
    interface Assignment {
        Long getAssignedUserId();
        Long getTeamId();
        Long getRecipientUserId();
        Long getRecipientOrganizationId();
        String getOrganizationName();
        String getNotificationSubject();
    }

    /** L'association à la mission autorise cette projection étroite entre organisations. */
    @Query(value = """
        SELECT i.assigned_user_id AS "assignedUserId", i.team_id AS "teamId",
            COALESCE(i.assigned_user_id,t.personal_user_id) AS "recipientUserId",
            CASE WHEN i.assigned_user_id IS NOT NULL THEN u.organization_id ELSE t.organization_id END AS "recipientOrganizationId",
            o.name AS "organizationName", u.keycloak_id AS "notificationSubject"
        FROM interventions i
        LEFT JOIN teams t ON t.id=i.team_id
        LEFT JOIN users u ON u.id=COALESCE(i.assigned_user_id,t.personal_user_id)
        LEFT JOIN organizations o ON o.id=CASE WHEN i.assigned_user_id IS NOT NULL THEN u.organization_id ELSE t.organization_id END
        WHERE i.id=:missionId AND i.organization_id=:orgId
        """, nativeQuery = true)
    Optional<Assignment> findAssignment(@Param("missionId") Long missionId, @Param("orgId") Long orgId);

    Optional<ProviderPayoutBeneficiary> findByInterventionIdAndOrganizationId(Long missionId, Long orgId);

    /** Même verrou pour la sélection et la préparation : le bénéficiaire est figé dès la réservation du versement. */
    @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('baitly-provider-payout:' || CAST(:missionId AS text),0))", nativeQuery = true)
    int lockMission(@Param("missionId") Long missionId);
}
