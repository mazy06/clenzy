package com.clenzy.repository;

import com.clenzy.model.WhatsAppConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WhatsAppConfigRepository extends JpaRepository<WhatsAppConfig, Long> {
    Optional<WhatsAppConfig> findByOrganizationId(Long organizationId);
}
