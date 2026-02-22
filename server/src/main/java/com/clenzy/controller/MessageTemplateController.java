package com.clenzy.controller;

import com.clenzy.dto.MessageTemplateDto;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD des modeles de messages pour la communication avec les voyageurs.
 */
@RestController
@RequestMapping("/api/message-templates")
@PreAuthorize("isAuthenticated()")
public class MessageTemplateController {

    private final MessageTemplateRepository templateRepository;
    private final TenantContext tenantContext;

    public MessageTemplateController(
            MessageTemplateRepository templateRepository,
            TenantContext tenantContext
    ) {
        this.templateRepository = templateRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<MessageTemplateDto> getAll() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return templateRepository.findByOrganizationIdOrderByNameAsc(orgId).stream()
            .map(MessageTemplateDto::fromEntity)
            .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<MessageTemplateDto> getById(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return templateRepository.findByIdAndOrganizationId(id, orgId)
            .map(MessageTemplateDto::fromEntity)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<MessageTemplateDto> create(@RequestBody MessageTemplateDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        MessageTemplate template = new MessageTemplate();
        template.setOrganizationId(orgId);
        template.setName(dto.name());
        template.setType(MessageTemplateType.valueOf(dto.type()));
        template.setSubject(dto.subject());
        template.setBody(dto.body());
        template.setLanguage(dto.language() != null ? dto.language() : "fr");
        template.setActive(true);

        MessageTemplate saved = templateRepository.save(template);
        return ResponseEntity.ok(MessageTemplateDto.fromEntity(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessageTemplateDto> update(@PathVariable Long id, @RequestBody MessageTemplateDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        return templateRepository.findByIdAndOrganizationId(id, orgId)
            .map(existing -> {
                if (dto.name() != null) existing.setName(dto.name());
                if (dto.type() != null) existing.setType(MessageTemplateType.valueOf(dto.type()));
                if (dto.subject() != null) existing.setSubject(dto.subject());
                if (dto.body() != null) existing.setBody(dto.body());
                if (dto.language() != null) existing.setLanguage(dto.language());
                return ResponseEntity.ok(MessageTemplateDto.fromEntity(templateRepository.save(existing)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        return templateRepository.findByIdAndOrganizationId(id, orgId)
            .map(existing -> {
                existing.setActive(false);
                templateRepository.save(existing);
                return ResponseEntity.noContent().<Void>build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Retourne la liste des variables disponibles pour les templates.
     */
    @GetMapping("/variables")
    public List<TemplateInterpolationService.TemplateVariable> getVariables() {
        return TemplateInterpolationService.SUPPORTED_VARIABLES;
    }
}
