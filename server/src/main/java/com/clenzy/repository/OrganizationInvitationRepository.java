package com.clenzy.repository;

import com.clenzy.model.InvitationStatus;
import com.clenzy.model.OrganizationInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationInvitationRepository extends JpaRepository<OrganizationInvitation, Long> {

    Optional<OrganizationInvitation> findByTokenHash(String tokenHash);

    List<OrganizationInvitation> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    List<OrganizationInvitation> findByOrganizationIdAndStatusOrderByCreatedAtDesc(
            Long organizationId, InvitationStatus status);

    boolean existsByOrganizationIdAndInvitedEmailAndStatus(
            Long organizationId, String invitedEmail, InvitationStatus status);

    @Query("SELECT i FROM OrganizationInvitation i WHERE i.invitedEmail = :email AND i.status = 'PENDING' AND i.expiresAt > CURRENT_TIMESTAMP")
    List<OrganizationInvitation> findPendingByEmail(@Param("email") String email);

    @Query("SELECT i FROM OrganizationInvitation i WHERE i.organizationId = :orgId AND i.status = 'PENDING' AND i.expiresAt > CURRENT_TIMESTAMP")
    List<OrganizationInvitation> findActivePendingByOrganizationId(@Param("orgId") Long orgId);
}
