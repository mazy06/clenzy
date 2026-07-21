package com.clenzy.controller;

import com.clenzy.dto.ReportExecutionRequest;
import com.clenzy.dto.ReportResultDto;
import com.clenzy.dto.ReportViewDto;
import com.clenzy.dto.ReportViewRequest;
import com.clenzy.service.report.ReportExecutionService;
import com.clenzy.service.report.ReportViewService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Report builder : CRUD des vues de rapport sauvegardées (CLZ-P0-15). Controller mince
 * (audit #4) — DTO records uniquement (audit #5), org résolue via TenantContext.
 */
@RestController
@RequestMapping("/api/reports/views")
@PreAuthorize("isAuthenticated()")
public class ReportBuilderController {

    private final ReportViewService reportViewService;
    private final ReportExecutionService reportExecutionService;
    private final TenantContext tenantContext;

    public ReportBuilderController(ReportViewService reportViewService,
                                   ReportExecutionService reportExecutionService,
                                   TenantContext tenantContext) {
        this.reportViewService = reportViewService;
        this.reportExecutionService = reportExecutionService;
        this.tenantContext = tenantContext;
    }

    @PostMapping
    public ResponseEntity<ReportViewDto> create(@RequestBody ReportViewRequest request,
                                                @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(reportViewService.create(request, orgId, jwt.getSubject()));
    }

    @GetMapping
    public List<ReportViewDto> list() {
        return reportViewService.list(tenantContext.getRequiredOrganizationId());
    }

    @GetMapping("/{id}")
    public ReportViewDto get(@PathVariable Long id) {
        return reportViewService.get(id, tenantContext.getRequiredOrganizationId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        reportViewService.delete(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    /** Exécution ad-hoc : définition complète dans la requête (validée par la whitelist). */
    @PostMapping("/execute")
    public ReportResultDto execute(@RequestBody ReportExecutionRequest request) {
        return reportExecutionService.execute(
                request.dimensions(), request.metrics(), request.granularity(),
                request.from(), request.to(), tenantContext.getRequiredOrganizationId());
    }

    /** Exécution d'une vue sauvegardée (org-gardée) sur la période fournie. */
    @PostMapping("/{id}/execute")
    public ReportResultDto executeView(@PathVariable Long id,
                                       @RequestBody ReportExecutionRequest request) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final ReportViewDto view = reportViewService.get(id, orgId);
        return reportExecutionService.execute(
                view.dimensions(), view.metrics(), view.granularity(),
                request.from(), request.to(), orgId);
    }
}
