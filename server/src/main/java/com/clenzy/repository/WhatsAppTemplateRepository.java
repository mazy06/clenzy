package com.clenzy.repository;

import com.clenzy.model.WhatsAppTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WhatsAppTemplateRepository extends JpaRepository<WhatsAppTemplate, Long> {
    List<WhatsAppTemplate> findByOrganizationId(Long organizationId);
}
