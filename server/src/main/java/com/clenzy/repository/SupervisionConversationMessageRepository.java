package com.clenzy.repository;

import com.clenzy.model.SupervisionConversationMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupervisionConversationMessageRepository
        extends JpaRepository<SupervisionConversationMessage, Long> {

    /** Historique d'un logement (chrono inversé, org-scopé). Limiter via {@link Pageable}. */
    List<SupervisionConversationMessage> findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
            Long organizationId, Long propertyId, Pageable pageable);
}
