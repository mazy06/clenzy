package com.clenzy.controller;

import com.clenzy.service.BaitlyCommerceReadiness;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Configuration globale Baitly et configuration PSP de l'organisation active, sans secrets. */
@RestController
@RequestMapping("/api/payment-configs/diagnostic")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyCommerceReadinessController {
    private final BaitlyCommerceReadiness readiness;
    private final TenantContext tenant;

    public BaitlyCommerceReadinessController(BaitlyCommerceReadiness readiness, TenantContext tenant) {
        this.readiness = readiness; this.tenant = tenant;
    }

    @GetMapping
    public BaitlyCommerceReadiness.Report inspect(@RequestParam(defaultValue = "false") boolean verify) {
        return readiness.inspect(tenant.getRequiredOrganizationId(), verify);
    }
}
