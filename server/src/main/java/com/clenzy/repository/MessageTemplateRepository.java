package com.clenzy.repository;

import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageTemplateRepository extends JpaRepository<MessageTemplate, Long> {

    List<MessageTemplate> findByOrganizationIdOrderByNameAsc(Long organizationId);

    List<MessageTemplate> findByOrganizationIdAndIsActiveTrue(Long organizationId);

    List<MessageTemplate> findByOrganizationIdAndTypeAndIsActiveTrue(Long organizationId, MessageTemplateType type);

    Optional<MessageTemplate> findByIdAndOrganizationId(Long id, Long organizationId);
}
