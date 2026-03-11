package com.clenzy.controller;

import com.clenzy.dto.WorkflowSettingsDto;
import com.clenzy.model.WorkflowSettings;
import com.clenzy.repository.WorkflowSettingsRepository;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workflow-settings")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Workflow Settings", description = "Parametres workflow par organisation")
public class WorkflowSettingsController {

    private final WorkflowSettingsRepository repository;
    private final TenantContext tenantContext;

    public WorkflowSettingsController(WorkflowSettingsRepository repository,
                                      TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Obtenir les parametres workflow de l'organisation courante")
    public ResponseEntity<WorkflowSettingsDto> get() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        WorkflowSettings entity = repository.findByOrganizationId(orgId).orElse(null);

        if (entity == null) {
            // Retourner les valeurs par defaut
            return ResponseEntity.ok(new WorkflowSettingsDto());
        }
        return ResponseEntity.ok(toDto(entity));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Mettre a jour les parametres workflow")
    public ResponseEntity<WorkflowSettingsDto> update(@RequestBody WorkflowSettingsDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        WorkflowSettings entity = repository.findByOrganizationId(orgId)
                .orElseGet(() -> {
                    WorkflowSettings ws = new WorkflowSettings();
                    ws.setOrganizationId(orgId);
                    return ws;
                });

        entity.setAutoAssignInterventions(dto.isAutoAssignInterventions());
        entity.setCancellationDeadlineHours(dto.getCancellationDeadlineHours());
        entity.setRequireApprovalForChanges(dto.isRequireApprovalForChanges());
        entity = repository.save(entity);

        return ResponseEntity.ok(toDto(entity));
    }

    private WorkflowSettingsDto toDto(WorkflowSettings entity) {
        return new WorkflowSettingsDto(
                entity.isAutoAssignInterventions(),
                entity.getCancellationDeadlineHours(),
                entity.isRequireApprovalForChanges()
        );
    }
}
