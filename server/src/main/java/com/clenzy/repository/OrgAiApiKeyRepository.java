package com.clenzy.repository;

import com.clenzy.model.OrgAiApiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrgAiApiKeyRepository extends JpaRepository<OrgAiApiKey, Long> {

    Optional<OrgAiApiKey> findByOrganizationIdAndProvider(Long organizationId, String provider);

    List<OrgAiApiKey> findByOrganizationId(Long organizationId);

    void deleteByOrganizationIdAndProvider(Long organizationId, String provider);
}
