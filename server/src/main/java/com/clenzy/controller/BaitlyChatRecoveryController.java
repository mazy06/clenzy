package com.clenzy.controller;

import com.clenzy.service.agent.BaitlyChatRecoveryService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agui/recovery")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','SUPERVISOR')")
public class BaitlyChatRecoveryController {
    private final BaitlyChatRecoveryService recovery;
    private final TenantContext tenant;
    public BaitlyChatRecoveryController(BaitlyChatRecoveryService recovery, TenantContext tenant) {
        this.recovery = recovery; this.tenant = tenant;
    }
    @GetMapping
    public BaitlyChatRecoveryService.Recovery read(@RequestParam Long conversationId, @AuthenticationPrincipal Jwt jwt) {
        return recovery.read(conversationId, jwt.getSubject(), tenant.getRequiredOrganizationId());
    }
}
