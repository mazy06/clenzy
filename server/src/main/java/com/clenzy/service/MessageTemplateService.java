package com.clenzy.service;

import com.clenzy.dto.MessageTemplateDto;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.repository.MessageTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CRUD des modeles de messages pour la communication avec les voyageurs.
 * Logique deplacee depuis {@code MessageTemplateController} (refactor
 * T-ARCH-01 — controller mince).
 *
 * <h2>Securite</h2>
 * <p>Tous les acces unitaires passent par
 * {@code findByIdAndOrganizationId(id, orgId)} : un template d'une autre
 * organisation est introuvable (ownership org systematique).</p>
 */
@Service
public class MessageTemplateService {

    private final MessageTemplateRepository templateRepository;

    public MessageTemplateService(MessageTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    @Transactional(readOnly = true)
    public List<MessageTemplate> getTemplates(Long organizationId) {
        return templateRepository.findByOrganizationIdOrderByNameAsc(organizationId);
    }

    @Transactional(readOnly = true)
    public Optional<MessageTemplate> getTemplate(Long id, Long organizationId) {
        return templateRepository.findByIdAndOrganizationId(id, organizationId);
    }

    @Transactional
    public MessageTemplate createTemplate(Long organizationId, MessageTemplateDto dto) {
        MessageTemplate template = new MessageTemplate();
        template.setOrganizationId(organizationId);
        template.setName(dto.name());
        template.setType(MessageTemplateType.valueOf(dto.type()));
        template.setSubject(dto.subject());
        template.setBody(dto.body());
        template.setLanguage(dto.language() != null ? dto.language() : "fr");
        template.setActive(true);
        return templateRepository.save(template);
    }

    /** Patch partiel : seuls les champs non-null du DTO sont appliques. */
    @Transactional
    public Optional<MessageTemplate> updateTemplate(Long id, Long organizationId, MessageTemplateDto dto) {
        return templateRepository.findByIdAndOrganizationId(id, organizationId)
            .map(existing -> {
                if (dto.name() != null) existing.setName(dto.name());
                if (dto.type() != null) existing.setType(MessageTemplateType.valueOf(dto.type()));
                if (dto.subject() != null) existing.setSubject(dto.subject());
                if (dto.body() != null) existing.setBody(dto.body());
                if (dto.language() != null) existing.setLanguage(dto.language());
                return templateRepository.save(existing);
            });
    }

    /** Suppression logique (active = false). Retourne false si introuvable dans l'org. */
    @Transactional
    public boolean deactivateTemplate(Long id, Long organizationId) {
        return templateRepository.findByIdAndOrganizationId(id, organizationId)
            .map(existing -> {
                existing.setActive(false);
                templateRepository.save(existing);
                return true;
            })
            .orElse(false);
    }
}
