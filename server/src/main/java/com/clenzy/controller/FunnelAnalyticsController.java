package com.clenzy.controller;

import com.clenzy.booking.service.BookingFunnelAnalyticsService;
import com.clenzy.dto.FunnelAnalyticsDto;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Funnel booking engine (fondations RMS R1) — org-scope strict via TenantContext
 * (le funnel est au niveau de l'organisation, comme le booking engine).
 * Controller mince : validation + délégation + DTO.
 */
@RestController
@RequestMapping("/api/analytics/funnel")
@PreAuthorize("isAuthenticated()")
public class FunnelAnalyticsController {

    private static final int MAX_PERIOD_DAYS = 366;

    private final BookingFunnelAnalyticsService funnelAnalyticsService;
    private final TenantContext tenantContext;
    private final Clock clock;

    public FunnelAnalyticsController(BookingFunnelAnalyticsService funnelAnalyticsService,
                                     TenantContext tenantContext,
                                     Clock clock) {
        this.funnelAnalyticsService = funnelAnalyticsService;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    @GetMapping
    public FunnelAnalyticsDto getFunnel(
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        final LocalDate today = LocalDate.now(clock);
        final LocalDate effectiveTo = to != null ? to : today;
        final LocalDate effectiveFrom = from != null ? from : effectiveTo.minusDays(29);
        if (effectiveFrom.isAfter(effectiveTo)
                || ChronoUnit.DAYS.between(effectiveFrom, effectiveTo) > MAX_PERIOD_DAYS) {
            throw new IllegalArgumentException("Période invalide (max " + MAX_PERIOD_DAYS + " jours)");
        }
        return funnelAnalyticsService.getAnalytics(
                tenantContext.getRequiredOrganizationId(), effectiveFrom, effectiveTo);
    }
}
