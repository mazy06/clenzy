package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceNotificationOutbox;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Diagnostic sans adresses, messages ni jetons, réservé aux modérateurs. */
@RestController
@RequestMapping("/api/admin/marketplace/providers")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketplaceNotificationController {
    private final MarketplaceNotificationOutbox outbox;
    public MarketplaceNotificationController(MarketplaceNotificationOutbox outbox) { this.outbox=outbox; }
    @GetMapping("/{id}/notifications")
    public List<MarketplaceNotificationOutbox.State> states(@PathVariable Long id) { return outbox.states(id); }
}
