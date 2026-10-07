package com.clenzy.controller;

import com.clenzy.service.payout.PayoutMonitoringService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounting/payout-transfers/monitoring")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PayoutMonitoringController {
    private final PayoutMonitoringService service;
    private final TenantContext tenant;
    public PayoutMonitoringController(PayoutMonitoringService service, TenantContext tenant) {
        this.service=service; this.tenant=tenant;
    }
    @GetMapping
    public PayoutMonitoringService.Monitoring read(@RequestParam(defaultValue="0") int page) {
        return service.read(tenant.getRequiredOrganizationId(),page);
    }
}
