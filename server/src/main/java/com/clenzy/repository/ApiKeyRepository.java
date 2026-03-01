package com.clenzy.repository;

import com.clenzy.model.ApiKey;
import com.clenzy.model.ApiKey.ApiKeyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    @Query("SELECT k FROM ApiKey k WHERE k.keyHash = :hash AND k.status = 'ACTIVE'")
    Optional<ApiKey> findActiveByKeyHash(@Param("hash") String hash);

    @Query("SELECT k FROM ApiKey k WHERE k.organizationId = :orgId")
    List<ApiKey> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT k FROM ApiKey k WHERE k.id = :id AND k.organizationId = :orgId")
    Optional<ApiKey> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT k FROM ApiKey k WHERE k.status = :status AND k.organizationId = :orgId")
    List<ApiKey> findByStatus(@Param("status") ApiKeyStatus status, @Param("orgId") Long orgId);
}
