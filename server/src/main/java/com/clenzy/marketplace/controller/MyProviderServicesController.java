package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.ProviderServiceManagement;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/my-provider-services")
@PreAuthorize("isAuthenticated()")
public class MyProviderServicesController {
    private final ProviderServiceManagement service;
    public MyProviderServicesController(ProviderServiceManagement service) { this.service=service; }
    @GetMapping public ProviderServiceManagement.View mine(@AuthenticationPrincipal Jwt jwt) {
        return service.mine(jwt.getSubject());
    }
    @PutMapping public ProviderServiceManagement.Row replace(@RequestParam String key,
            @RequestBody ProviderServiceManagement.Command command,@AuthenticationPrincipal Jwt jwt) {
        return service.replace(jwt.getSubject(),key,command);
    }
}
