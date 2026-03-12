package com.clenzy.controller;

import com.clenzy.dto.AiInsightDto;
import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.tenant.TenantContext;
import com.clenzy.service.AiAnalyticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/ai/analytics")
@PreAuthorize("isAuthenticated()")
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

    @GetMapping("/{propertyId}/ai-insights")
    public List<AiInsightDto> getAiInsights(
            @PathVariable Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return aiAnalyticsService.getAiInsights(
            propertyId, tenantContext.getRequiredOrganizationId(), from, to);
    }
}
