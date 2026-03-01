package com.clenzy.controller;

import com.clenzy.dto.PricePredictionDto;
import com.clenzy.service.AiPricingService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/ai/pricing")
public class AiPricingController {

    private final AiPricingService aiPricingService;
    private final TenantContext tenantContext;

    public AiPricingController(AiPricingService aiPricingService,
                                TenantContext tenantContext) {
        this.aiPricingService = aiPricingService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/{propertyId}/predictions")
    public List<PricePredictionDto> getPredictions(
            @PathVariable Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return aiPricingService.getPredictions(
            propertyId, tenantContext.getOrganizationId(), from, to);
    }
}
