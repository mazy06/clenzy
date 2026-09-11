package com.clenzy.controller;

import com.clenzy.service.PortfolioPulseService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Agregats de parc du tableau de bord — stock a recommander, positionnement
 * tarifaire. Lecture seule, org-scopee : aucun identifiant de bien n'est
 * accepte en entree, le tenant borne les deux requetes.
 */
@RestController
@RequestMapping("/api/portfolio-pulse")
@PreAuthorize("isAuthenticated()")
public class PortfolioPulseController {

    private final PortfolioPulseService pulseService;
    private final TenantContext tenantContext;

    public PortfolioPulseController(PortfolioPulseService pulseService, TenantContext tenantContext) {
        this.pulseService = pulseService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/stock-reorder")
    @Operation(summary = "Articles sous leur seuil de reassort, tout le parc")
    public List<PortfolioPulseService.ReorderItem> stockReorder() {
        return pulseService.stockToReorder(tenantContext.getRequiredOrganizationId());
    }

    @GetMapping("/positioning")
    @Operation(summary = "Positionnement tarifaire de chaque bien face a son marche")
    public List<PortfolioPulseService.PropertyPositioning> positioning() {
        return pulseService.positioning(tenantContext.getRequiredOrganizationId());
    }
}
