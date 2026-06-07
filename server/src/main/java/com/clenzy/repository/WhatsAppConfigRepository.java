package com.clenzy.repository;

import com.clenzy.model.WhatsAppConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WhatsAppConfigRepository extends JpaRepository<WhatsAppConfig, Long> {
    Optional<WhatsAppConfig> findByOrganizationId(Long organizationId);

    /**
     * Config WhatsApp GLOBALE (singleton plateforme) : la ligne organization_id IS NULL.
     * C'est la seule config utilisee pour l'envoi depuis le passage en compte unique (0192).
     */
    Optional<WhatsAppConfig> findFirstByOrganizationIdIsNull();
}
