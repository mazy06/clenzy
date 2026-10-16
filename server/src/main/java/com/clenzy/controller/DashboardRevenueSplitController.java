package com.clenzy.controller;

import com.clenzy.dto.MonthlyRevenueSplitDto;
import com.clenzy.service.DashboardRevenueSplitService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/** Synthèse financière Baitly, organisation et propriétaire issus de la session. */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'PROPERTY_OWNER', 'SUPERVISOR')")
public class DashboardRevenueSplitController {
    private final DashboardRevenueSplitService service;
    private final TenantContext tenantContext;
    private final Clock clock;

    public DashboardRevenueSplitController(DashboardRevenueSplitService service, TenantContext tenantContext, Clock clock) {
        this.service = service;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    @GetMapping("/revenue-split")
    public List<MonthlyRevenueSplitDto> getYear(@RequestParam(required = false) Integer year, @AuthenticationPrincipal Jwt jwt) {
        return service.getYear(tenantContext.getRequiredOrganizationId(), year != null ? year : LocalDate.now(clock).getYear(),
            JwtRoleExtractor.extractUserRole(jwt), jwt.getSubject());
    }
}
