package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.inventory.*;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.service.PropertyInventoryService;
import com.clenzy.service.PropertyService;
import com.clenzy.service.UserService;
import com.clenzy.util.JwtRoleExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Inventaire des objets et du linge d'une propriete + devis blanchisserie.
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/inventory")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Property Inventory", description = "Inventaire logement, linge et devis blanchisserie")
public class PropertyInventoryController {

    private static final Logger log = LoggerFactory.getLogger(PropertyInventoryController.class);

    private final PropertyInventoryService inventoryService;
    private final PropertyService propertyService;
    private final UserService userService;

    public PropertyInventoryController(PropertyInventoryService inventoryService,
                                        PropertyService propertyService,
                                        UserService userService) {
        this.inventoryService = inventoryService;
        this.propertyService = propertyService;
        this.userService = userService;
    }

    // ── Inventory Items ──────────────────────────────────────────────────

    @GetMapping("/items")
    @Operation(summary = "Lister les objets de l'inventaire d'une propriete")
    public ResponseEntity<List<PropertyInventoryItemDto>> getItems(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.getInventoryItems(propertyId));
    }

    @PostMapping("/items")
    @Operation(summary = "Ajouter un objet a l'inventaire")
    public ResponseEntity<PropertyInventoryItemDto> addItem(
            @PathVariable Long propertyId,
            @RequestBody PropertyInventoryItemDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.addInventoryItem(propertyId, dto));
    }

    @PutMapping("/items/{itemId}")
    @Operation(summary = "Modifier un objet de l'inventaire")
    public ResponseEntity<PropertyInventoryItemDto> updateItem(
            @PathVariable Long propertyId,
            @PathVariable Long itemId,
            @RequestBody PropertyInventoryItemDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.updateInventoryItem(propertyId, itemId, dto));
    }

    @DeleteMapping("/items/{itemId}")
    @Operation(summary = "Supprimer un objet de l'inventaire")
    public ResponseEntity<Void> deleteItem(
            @PathVariable Long propertyId,
            @PathVariable Long itemId,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        inventoryService.deleteInventoryItem(propertyId, itemId);
        return ResponseEntity.noContent().build();
    }

    // ── Laundry Items ────────────────────────────────────────────────────

    @GetMapping("/laundry")
    @Operation(summary = "Lister les articles de linge d'une propriete")
    public ResponseEntity<List<PropertyLaundryItemDto>> getLaundryItems(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.getLaundryItems(propertyId));
    }

    @PostMapping("/laundry")
    @Operation(summary = "Ajouter un article de linge")
    public ResponseEntity<PropertyLaundryItemDto> addLaundryItem(
            @PathVariable Long propertyId,
            @RequestBody PropertyLaundryItemDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.addLaundryItem(propertyId, dto));
    }

    @PutMapping("/laundry/{itemId}")
    @Operation(summary = "Modifier un article de linge")
    public ResponseEntity<PropertyLaundryItemDto> updateLaundryItem(
            @PathVariable Long propertyId,
            @PathVariable Long itemId,
            @RequestBody PropertyLaundryItemDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.updateLaundryItem(propertyId, itemId, dto));
    }

    @DeleteMapping("/laundry/{itemId}")
    @Operation(summary = "Supprimer un article de linge")
    public ResponseEntity<Void> deleteLaundryItem(
            @PathVariable Long propertyId,
            @PathVariable Long itemId,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        inventoryService.deleteLaundryItem(propertyId, itemId);
        return ResponseEntity.noContent().build();
    }

    // ── Blanchisserie Catalog ────────────────────────────────────────────

    @GetMapping("/laundry/catalog")
    @Operation(summary = "Obtenir le catalogue blanchisserie (articles actifs avec prix)")
    public ResponseEntity<List<PricingConfigDto.BlanchisserieItem>> getCatalog() {
        return ResponseEntity.ok(inventoryService.getBlanchisserieCatalog());
    }

    // ── Quotes ───────────────────────────────────────────────────────────

    @GetMapping("/laundry/quotes")
    @Operation(summary = "Lister les devis/factures blanchisserie d'une propriete")
    public ResponseEntity<List<LaundryQuoteDto>> getQuotes(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.getQuotes(propertyId));
    }

    @PostMapping("/laundry/quotes")
    @Operation(summary = "Generer un devis blanchisserie")
    public ResponseEntity<LaundryQuoteDto> generateQuote(
            @PathVariable Long propertyId,
            @RequestBody GenerateLaundryQuoteRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.generateQuote(propertyId, request));
    }

    @PutMapping("/laundry/quotes/{quoteId}/confirm")
    @Operation(summary = "Confirmer un devis blanchisserie")
    public ResponseEntity<LaundryQuoteDto> confirmQuote(
            @PathVariable Long propertyId,
            @PathVariable Long quoteId,
            @AuthenticationPrincipal Jwt jwt) {
        checkAccess(propertyId, jwt);
        return ResponseEntity.ok(inventoryService.confirmQuote(propertyId, quoteId));
    }

    // ── Security ─────────────────────────────────────────────────────────

    private void checkAccess(Long propertyId, Jwt jwt) {
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        if (role == UserRole.HOST) {
            final String keycloakId = jwt.getSubject();
            final User user = userService.findByKeycloakId(keycloakId);
            if (user == null) {
                throw new AccessDeniedException("Utilisateur introuvable");
            }
            final var property = propertyService.getPropertyEntityById(propertyId);
            if (property == null) {
                throw new NotFoundException("Propriete introuvable");
            }
            if (property.getOwner() == null || !property.getOwner().getId().equals(user.getId())) {
                throw new AccessDeniedException("Vous n'avez pas acces a cette propriete");
            }
        }
    }
}
