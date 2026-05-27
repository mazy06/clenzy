package com.clenzy.repository;

import com.clenzy.model.OrgWhatsAppTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrgWhatsAppTemplateRepository extends JpaRepository<OrgWhatsAppTemplate, Long> {

    /**
     * Resolution d'un template logique pour une org. Utilise par BriefingDelivery
     * et tout autre service qui envoie un WhatsApp pour le compte de l'org.
     */
    Optional<OrgWhatsAppTemplate> findByOrganizationIdAndTemplateKey(Long organizationId,
                                                                       String templateKey);
}
