package com.clenzy.controller;

import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.tenant.TenantContext;
import com.clenzy.service.AiAnalyticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/ai/analytics")
public class AiAnalyticsController {

    private final AiAnalyticsService aiAnalyticsService;
    private final TenantContext tenantContext;

    public AiAnalyticsController(AiAnalyticsService aiAnalyticsService,
                                  TenantContext tenantContext) {
        this.aiAnalyticsService = aiAnalyticsService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/{propertyId}")
    public RevenueAnalyticsDto getAnalytics(
            @PathVariable Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return aiAnalyticsService.getAnalytics(propertyId, tenantContext.getOrganizationId(), from, to);
    }
}
