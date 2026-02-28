package com.clenzy.repository;

import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WebhookConfigRepository extends JpaRepository<WebhookConfig, Long> {

    @Query("SELECT w FROM WebhookConfig w WHERE w.organizationId = :orgId")
    List<WebhookConfig> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT w FROM WebhookConfig w WHERE w.id = :id AND w.organizationId = :orgId")
    Optional<WebhookConfig> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT w FROM WebhookConfig w WHERE w.status = 'ACTIVE' AND w.organizationId = :orgId")
    List<WebhookConfig> findActiveByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT w FROM WebhookConfig w WHERE w.status = :status AND w.organizationId = :orgId")
    List<WebhookConfig> findByStatus(@Param("status") WebhookStatus status, @Param("orgId") Long orgId);
}
