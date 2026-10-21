package com.clenzy.controller;

import com.clenzy.service.BaitlyPaidServiceExecution;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/upsells/orders/{id}/execution")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyPaidServiceExecutionController {
    private final BaitlyPaidServiceExecution service;
    private final TenantContext tenant;
    public BaitlyPaidServiceExecutionController(BaitlyPaidServiceExecution service,TenantContext tenant) {this.service=service;this.tenant=tenant;}
    @GetMapping public BaitlyPaidServiceExecution.View inspect(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        return service.inspect(id,tenant.getRequiredOrganizationId(),jwt);
    }
    @PostMapping public BaitlyPaidServiceExecution.View schedule(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt,
            @RequestBody BaitlyPaidServiceExecution.Schedule plan) {
        return service.schedule(id,tenant.getRequiredOrganizationId(),jwt,plan);
    }
}
