package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceReviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/quote-requests/{id}/review")
@PreAuthorize("isAuthenticated()")
public class MarketplaceReviewController {
    private final MarketplaceReviewService service;
    public MarketplaceReviewController(MarketplaceReviewService service) { this.service = service; }
    public record Command(@Min(1) @Max(5) int rating, @Size(max = 1000) String feedback) {}
    @GetMapping
    public MarketplaceReviewService.View get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return service.get(id, jwt);
    }
    @PostMapping
    public MarketplaceReviewService.View submit(@PathVariable Long id, @Valid @RequestBody Command command,
            @AuthenticationPrincipal Jwt jwt) {
        return service.submit(id, command.rating(), command.feedback(), jwt);
    }
}
