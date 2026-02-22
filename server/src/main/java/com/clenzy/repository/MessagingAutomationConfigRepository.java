package com.clenzy.repository;

import com.clenzy.model.MessagingAutomationConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessagingAutomationConfigRepository extends JpaRepository<MessagingAutomationConfig, Long> {

    Optional<MessagingAutomationConfig> findByOrganizationId(Long organizationId);

    /**
     * Trouve toutes les configs qui ont au moins un auto-send actif.
     * Utilise par le scheduler pour trouver les orgs a traiter.
     */
    List<MessagingAutomationConfig> findByAutoSendCheckInTrueOrAutoSendCheckOutTrue();
}
