package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.service.PricingConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pricing-config")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PricingConfigController {

    private static final Logger log = LoggerFactory.getLogger(PricingConfigController.class);

    private final PricingConfigService pricingConfigService;

    public PricingConfigController(PricingConfigService pricingConfigService) {
        this.pricingConfigService = pricingConfigService;
    }

    @GetMapping
    public ResponseEntity<PricingConfigDto> getCurrentConfig() {
        return ResponseEntity.ok(pricingConfigService.getCurrentConfig());
    }

    @PutMapping
    public ResponseEntity<PricingConfigDto> updateConfig(
            @RequestBody PricingConfigDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        log.info("Mise a jour de la configuration tarifaire par l'utilisateur {}", jwt.getSubject());
        return ResponseEntity.ok(pricingConfigService.updateConfig(dto));
    }
}
