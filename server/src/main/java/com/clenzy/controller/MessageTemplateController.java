package com.clenzy.controller;

import com.clenzy.dto.MessageTemplateDto;
import com.clenzy.service.MessageTemplateService;
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

    private final MessageTemplateService templateService;
    private final TenantContext tenantContext;

    public MessageTemplateController(
            MessageTemplateService templateService,
            TenantContext tenantContext
    ) {
        this.templateService = templateService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<MessageTemplateDto> getAll() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return templateService.getTemplates(orgId).stream()
            .map(MessageTemplateDto::fromEntity)
            .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<MessageTemplateDto> getById(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return templateService.getTemplate(id, orgId)
            .map(MessageTemplateDto::fromEntity)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<MessageTemplateDto> create(@RequestBody MessageTemplateDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(MessageTemplateDto.fromEntity(templateService.createTemplate(orgId, dto)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessageTemplateDto> update(@PathVariable Long id, @RequestBody MessageTemplateDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return templateService.updateTemplate(id, orgId, dto)
            .map(MessageTemplateDto::fromEntity)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return templateService.deactivateTemplate(id, orgId)
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }

    /**
     * Retourne la liste des variables disponibles pour les templates.
     */
    @GetMapping("/variables")
    public List<TemplateInterpolationService.TemplateVariable> getVariables() {
        return TemplateInterpolationService.SUPPORTED_VARIABLES;
    }
}
