package com.clenzy.controller;

import com.clenzy.service.PropertyStockService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Visuel partagé par l'inventaire et les cartes, sans copier la photo dans les suggestions. */
@RestController
@RequestMapping("/api/stock-items")
@PreAuthorize("isAuthenticated()")
public class StockItemVisualController {
    private final PropertyStockService stockService;
    private final TenantContext tenantContext;

    public StockItemVisualController(PropertyStockService stockService, TenantContext tenantContext) {
        this.stockService = stockService;
        this.tenantContext = tenantContext;
    }

    public record VisualDto(String name, String catalogKey, String photoUrl) {}

    @GetMapping("/{id}/visual")
    public VisualDto visual(@PathVariable Long id) {
        // Identifiant + organisation du JWT : un article d'un autre tenant est introuvable.
        var item = stockService.findForOrganization(id, tenantContext.getRequiredOrganizationId());
        return new VisualDto(item.getName(), item.getCatalogKey(), item.getPhotoUrl());
    }
}
