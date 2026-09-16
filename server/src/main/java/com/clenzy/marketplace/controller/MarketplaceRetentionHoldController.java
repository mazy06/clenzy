package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceRetentionHoldService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;

/** Dossiers plateforme : accès réservé aux gestionnaires de la marketplace. */
@RestController
@RequestMapping("/api/admin/marketplace/providers/{id}/retention-hold")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketplaceRetentionHoldController {
    private final MarketplaceRetentionHoldService service;
    public MarketplaceRetentionHoldController(MarketplaceRetentionHoldService service) { this.service = service; }
    public record Hold(@NotBlank @Size(max = 1000) String reason, @NotNull LocalDateTime reviewAt) {}

    @GetMapping
    public MarketplaceRetentionHoldService.View view(@PathVariable Long id) { return service.view(id); }

    @PutMapping
    public MarketplaceRetentionHoldService.View hold(@PathVariable Long id, @Valid @RequestBody Hold body,
            @AuthenticationPrincipal Jwt jwt) { return service.update(id, body.reason(), body.reviewAt(), jwt.getSubject()); }

    @DeleteMapping
    public MarketplaceRetentionHoldService.View release(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, null, null, jwt.getSubject());
    }
}
