package com.clenzy.repository;

import com.clenzy.model.AssistantWorkflowRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AssistantWorkflowRunRepository extends JpaRepository<AssistantWorkflowRun, Long> {

    /**
     * Resolution d'un run par id avec validation d'ownership user.
     * Le filtre Hibernate organizationFilter ajoute la contrainte multi-tenant.
     */
    @Query("SELECT r FROM AssistantWorkflowRun r WHERE r.id = :id AND r.keycloakId = :keycloakId")
    Optional<AssistantWorkflowRun> findByIdAndUser(@Param("id") Long id,
                                                    @Param("keycloakId") String keycloakId);

    /**
     * Liste les runs actifs d'un user, plus recent en premier.
     */
    @Query("SELECT r FROM AssistantWorkflowRun r WHERE r.keycloakId = :keycloakId "
            + "AND r.status = 'ACTIVE' ORDER BY r.startedAt DESC")
    List<AssistantWorkflowRun> findActiveByUser(@Param("keycloakId") String keycloakId);
}
