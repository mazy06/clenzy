package com.clenzy.controller;

import com.clenzy.dto.MigrationJobDto;
import com.clenzy.model.MigrationJob.MigrationDataType;
import com.clenzy.model.MigrationJob.MigrationSource;
import com.clenzy.service.PmsMigrationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/migration")
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
        return migrationService.getAllJobs(tenantContext.getOrganizationId());
    }

    @GetMapping("/{id}")
    public MigrationJobDto getById(@PathVariable Long id) {
        return migrationService.getJobById(id, tenantContext.getOrganizationId());
    }

    @PostMapping
    public MigrationJobDto create(@RequestBody Map<String, String> body) {
        return migrationService.createJob(
            MigrationSource.valueOf(body.get("source")),
            body.containsKey("dataType") ? MigrationDataType.valueOf(body.get("dataType")) : MigrationDataType.ALL,
            body.get("apiKey"),
            body.get("config"),
            tenantContext.getOrganizationId()
        );
    }

    @PutMapping("/{id}/start")
    public MigrationJobDto start(@PathVariable Long id) {
        return migrationService.startJob(id, tenantContext.getOrganizationId());
    }

    @PutMapping("/{id}/progress")
    public MigrationJobDto updateProgress(@PathVariable Long id,
                                            @RequestBody Map<String, Integer> body) {
        return migrationService.updateProgress(id, tenantContext.getOrganizationId(),
            body.getOrDefault("processed", 0), body.getOrDefault("failed", 0));
    }
}
