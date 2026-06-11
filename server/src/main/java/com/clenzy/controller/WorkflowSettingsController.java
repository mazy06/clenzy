package com.clenzy.controller;

import com.clenzy.dto.WorkflowSettingsDto;
import com.clenzy.service.WorkflowSettingsService;
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

    private final WorkflowSettingsService workflowSettingsService;

    public WorkflowSettingsController(WorkflowSettingsService workflowSettingsService) {
        this.workflowSettingsService = workflowSettingsService;
    }

    @GetMapping
    @Operation(summary = "Obtenir les parametres workflow de l'organisation courante")
    public ResponseEntity<WorkflowSettingsDto> get() {
        return ResponseEntity.ok(workflowSettingsService.getForCurrentOrganization());
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Mettre a jour les parametres workflow")
    public ResponseEntity<WorkflowSettingsDto> update(@RequestBody WorkflowSettingsDto dto) {
        return ResponseEntity.ok(workflowSettingsService.updateForCurrentOrganization(dto));
    }
}
