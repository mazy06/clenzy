package com.clenzy.controller;

import com.clenzy.dto.MigrationJobDto;
import com.clenzy.model.MigrationJob.MigrationSource;
import com.clenzy.service.PmsMigrationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/migration")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class MigrationController {

    private final PmsMigrationService migrationService;
    private final TenantContext tenantContext;

    public MigrationController(PmsMigrationService migrationService,
                                TenantContext tenantContext) {
        this.migrationService = migrationService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/sources")
    public List<MigrationSource> getSources() {
        return migrationService.getAvailableSources();
    }

    @GetMapping
    public List<MigrationJobDto> getAll() {
        return migrationService.getAllJobs(tenantContext.getRequiredOrganizationId());
    }

    @GetMapping("/{id}")
    public MigrationJobDto getById(@PathVariable Long id) {
        return migrationService.getJobById(id, tenantContext.getRequiredOrganizationId());
    }

    @PostMapping
    public MigrationJobDto create(@RequestBody Map<String, String> body) {
        throw unsupportedApiMigration();
    }

    @PutMapping("/{id}/start")
    public MigrationJobDto start(@PathVariable Long id) {
        throw unsupportedApiMigration();
    }

    @PutMapping("/{id}/progress")
    public MigrationJobDto updateProgress(@PathVariable Long id,
                                            @RequestBody Map<String, Integer> body) {
        throw unsupportedApiMigration();
    }

    private org.springframework.web.server.ResponseStatusException unsupportedApiMigration() {
        return new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_IMPLEMENTED,
            "Les migrations API ne sont pas disponibles. Utilisez l'import de fichiers /api/migration/imports.");
    }
}
