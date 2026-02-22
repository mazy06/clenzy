package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.service.PricingConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/pricing-config")
@PreAuthorize("isAuthenticated()")
public class PricingConfigController {

    private static final Logger log = LoggerFactory.getLogger(PricingConfigController.class);

    private final PricingConfigService pricingConfigService;

    public PricingConfigController(PricingConfigService pricingConfigService) {
        this.pricingConfigService = pricingConfigService;
    }

    @GetMapping
    public ResponseEntity<PricingConfigDto> getCurrentConfig(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!hasAnyRole(jwt, "SUPER_ADMIN", "SUPER_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(pricingConfigService.getCurrentConfig());
    }

    @PutMapping
    public ResponseEntity<PricingConfigDto> updateConfig(
            @RequestBody PricingConfigDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!hasAnyRole(jwt, "SUPER_ADMIN", "SUPER_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        log.info("Mise a jour de la configuration tarifaire par l'utilisateur {}", jwt.getSubject());
        return ResponseEntity.ok(pricingConfigService.updateConfig(dto));
    }

    private boolean hasAnyRole(Jwt jwt, String... rolesToCheck) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;
                    for (String role : rolesToCheck) {
                        if (roleList.stream().anyMatch(r -> role.equals(r.toString()))) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Erreur extraction role JWT: {}", e.getMessage());
        }
        return false;
    }
}
