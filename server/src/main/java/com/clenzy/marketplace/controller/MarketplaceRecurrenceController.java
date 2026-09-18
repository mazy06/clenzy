package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceRecurrenceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/quote-requests/{id}/recurrence")
@PreAuthorize("isAuthenticated()")
public class MarketplaceRecurrenceController {
    private final MarketplaceRecurrenceService service;
    public MarketplaceRecurrenceController(MarketplaceRecurrenceService service) { this.service = service; }
    public record State(MarketplaceRecurrenceService.View schedule) {}
    @GetMapping
    public State get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return new State(service.get(id, jwt));
    }
    @PutMapping
    public MarketplaceRecurrenceService.View configure(@PathVariable Long id,
            @RequestBody MarketplaceRecurrenceService.Command command, @AuthenticationPrincipal Jwt jwt) {
        return service.configure(id, command, jwt);
    }
}
