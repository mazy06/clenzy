package com.clenzy.repository;

import com.clenzy.model.OrgMemberRole;
import com.clenzy.model.OrganizationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, Long> {

    Optional<OrganizationMember> findByUserId(Long userId);

    @Query("SELECT om FROM OrganizationMember om JOIN om.user u WHERE u.keycloakId = :keycloakId")
    Optional<OrganizationMember> findByUserKeycloakId(@Param("keycloakId") String keycloakId);

    List<OrganizationMember> findByOrganizationId(Long organizationId);

    List<OrganizationMember> findByOrganizationIdAndRoleInOrg(Long organizationId, OrgMemberRole roleInOrg);

    boolean existsByOrganizationIdAndUserId(Long organizationId, Long userId);

    long countByOrganizationId(Long organizationId);

    void deleteByOrganizationIdAndUserId(Long organizationId, Long userId);

    Optional<OrganizationMember> findByIdAndOrganizationId(Long id, Long organizationId);

    @Query("SELECT om FROM OrganizationMember om JOIN FETCH om.user WHERE om.organization.id = :orgId")
    List<OrganizationMember> findByOrganizationIdWithUser(@Param("orgId") Long orgId);
}
