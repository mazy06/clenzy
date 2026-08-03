package com.clenzy.controller;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PropertyStockItem;
import com.clenzy.service.PropertyService;
import com.clenzy.service.PropertyStockService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Stock consommable d'un logement (fiche logement, M5). Alimente la carte
 * LINEN_STOCK_ORDER de l'agent Opérations (seuil + fournisseur).
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/stock")
@PreAuthorize("isAuthenticated()")
public class PropertyStockController {

    /** Shape stable (jamais l'entité — règle audit n°5). */
    public record StockItemDto(Long id, String name, String category, String unit,
                               int quantity, int reorderThreshold, int reorderQuantity,
                               int consumptionPerStay, String supplierName, String supplierEmail) {
        static StockItemDto from(PropertyStockItem i) {
            return new StockItemDto(i.getId(), i.getName(), i.getCategory().name(), i.getUnit(),
                    i.getQuantity(), i.getReorderThreshold(), i.getReorderQuantity(),
                    i.getConsumptionPerStay(), i.getSupplierName(), i.getSupplierEmail());
        }
    }

    private final PropertyStockService stockService;
    private final PropertyService propertyService;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final TenantContext tenantContext;

    public PropertyStockController(PropertyStockService stockService,
                                   PropertyService propertyService,
                                   OrganizationAccessGuard organizationAccessGuard,
                                   TenantContext tenantContext) {
        this.stockService = stockService;
        this.propertyService = propertyService;
        this.organizationAccessGuard = organizationAccessGuard;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister le stock consommable d'un logement")
    public ResponseEntity<List<StockItemDto>> list(@PathVariable Long propertyId) {
        checkAccess(propertyId);
        return ResponseEntity.ok(stockService.list(propertyId, tenantContext.getRequiredOrganizationId())
                .stream().map(StockItemDto::from).toList());
    }

    @PostMapping
    @Operation(summary = "Créer ou modifier un article de stock")
    public ResponseEntity<StockItemDto> save(@PathVariable Long propertyId,
                                             @RequestBody StockItemDto request) {
        checkAccess(propertyId);
        final PropertyStockItem item = new PropertyStockItem();
        item.setId(request.id());
        item.setName(request.name());
        item.setCategory(request.category() != null
                ? PropertyStockItem.Category.valueOf(request.category())
                : PropertyStockItem.Category.LINEN);
        item.setUnit(request.unit());
        item.setQuantity(Math.max(0, request.quantity()));
        item.setReorderThreshold(Math.max(0, request.reorderThreshold()));
        item.setReorderQuantity(Math.max(0, request.reorderQuantity()));
        item.setConsumptionPerStay(Math.max(0, request.consumptionPerStay()));
        item.setSupplierName(request.supplierName());
        item.setSupplierEmail(request.supplierEmail());
        return ResponseEntity.ok(StockItemDto.from(stockService.save(
                tenantContext.getRequiredOrganizationId(), propertyId, item)));
    }

    @PostMapping("/{id}/restock")
    @Operation(summary = "Confirmer un réassort (quantité livrée, défaut = quantité de réappro)")
    public ResponseEntity<StockItemDto> restock(@PathVariable Long propertyId,
                                                @PathVariable Long id,
                                                @RequestBody(required = false) Map<String, Integer> body) {
        checkAccess(propertyId);
        return ResponseEntity.ok(StockItemDto.from(stockService.restock(
                id, tenantContext.getRequiredOrganizationId(),
                body != null ? body.get("quantity") : null)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un article de stock")
    public ResponseEntity<Void> delete(@PathVariable Long propertyId, @PathVariable Long id) {
        checkAccess(propertyId);
        stockService.delete(id, propertyId, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    /** Ownership : le logement doit appartenir à l'org du requester (règle audit n°3). */
    private void checkAccess(Long propertyId) {
        final var property = propertyService.getPropertyEntityById(propertyId);
        if (property == null) {
            throw new NotFoundException("Propriété introuvable");
        }
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Vous n'avez pas accès à cette propriété");
    }
}
