package com.clenzy.controller;

import com.clenzy.service.migration.PmsImportService;
import com.clenzy.service.migration.PmsMigrationPlanService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/migration/plan")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class PmsMigrationPlanController {
    private final PmsMigrationPlanService plans;
    private final TenantContext tenant;

    public PmsMigrationPlanController(PmsMigrationPlanService plans, TenantContext tenant) {
        this.plans = plans; this.tenant = tenant;
    }

    @GetMapping
    public PmsMigrationPlanService.View get(@AuthenticationPrincipal Jwt jwt) { return plans.get(actor(jwt)); }

    @PutMapping
    public PmsMigrationPlanService.View save(@RequestBody PmsMigrationPlanService.Update update, @AuthenticationPrincipal Jwt jwt) {
        return plans.save(update, actor(jwt));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid() {
        return ResponseEntity.badRequest().body(Map.of("message", "PLAN_INVALID"));
    }

    private PmsImportService.Actor actor(Jwt jwt) {
        return new PmsImportService.Actor(tenant.getRequiredOrganizationId(), jwt.getSubject(),
            JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff());
    }
}
