package com.clenzy.controller;

import com.clenzy.dto.PaymentMethodConfigDto;
import com.clenzy.dto.PaymentMethodConfigUpdateRequest;
import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.service.PaymentMethodConfigService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

/**
 * Payment provider configuration — restricted to SUPER_ADMIN/SUPER_MANAGER.
 * Manages API keys (encrypted), sandbox mode, and country routing per provider.
 */
@RestController
@RequestMapping("/api/payment-configs")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class PaymentMethodConfigController {

    private final PaymentMethodConfigService configService;
    private final TenantContext tenantContext;

    public PaymentMethodConfigController(PaymentMethodConfigService configService,
                                          TenantContext tenantContext) {
        this.configService = configService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<PaymentMethodConfigDto>> listConfigs() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<PaymentMethodConfigDto> dtos = configService.getConfigsForOrganization(orgId).stream()
            .map(this::toDto)
            .toList();
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/{providerType}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<PaymentMethodConfigDto> updateConfig(
            @PathVariable String providerType,
            @RequestBody PaymentMethodConfigUpdateRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        PaymentProviderType type = PaymentProviderType.valueOf(providerType.toUpperCase());
        // Use the encrypted version — API keys, secrets are encrypted via AES-256-GCM
        PaymentMethodConfig config = configService.updateConfig(
            orgId, type, request.enabled(), request.countryCodes(), request.sandboxMode(),
            request.apiKey(), request.apiSecret(), null);
        return ResponseEntity.ok(toDto(config));
    }

    @GetMapping("/defaults/{countryCode}")
    public ResponseEntity<List<String>> getDefaults(@PathVariable String countryCode) {
        List<String> defaults = configService.getDefaultProvidersForCountry(countryCode).stream()
            .map(Enum::name)
            .toList();
        return ResponseEntity.ok(defaults);
    }

    private PaymentMethodConfigDto toDto(PaymentMethodConfig c) {
        List<String> countries = c.getCountryCodes() != null
            ? Arrays.asList(c.getCountryCodes().split(","))
            : List.of();
        return new PaymentMethodConfigDto(
            c.getId(),
            c.getProviderType().name(),
            Boolean.TRUE.equals(c.getEnabled()),
            countries,
            Boolean.TRUE.equals(c.getSandboxMode()),
            c.getConfigJson()
        );
    }
}
