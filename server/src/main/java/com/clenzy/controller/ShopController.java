package com.clenzy.controller;

import com.clenzy.dto.HardwareOrderDto;
import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareCatalog;
import com.clenzy.service.ShopService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shop")
@PreAuthorize("isAuthenticated()")
public class ShopController {

    private static final Logger log = LoggerFactory.getLogger(ShopController.class);

    private final ShopService shopService;
    private final com.clenzy.service.BaitlyCommerceOperations operations;
    private final com.clenzy.tenant.TenantContext tenant;
    private final com.clenzy.service.BaitlySaleDocumentStore documents;

    public ShopController(ShopService shopService,com.clenzy.service.BaitlyCommerceOperations operations,com.clenzy.tenant.TenantContext tenant,com.clenzy.service.BaitlySaleDocumentStore documents) {
        this.shopService = shopService;
        this.operations=operations;this.tenant=tenant;this.documents=documents;
    }

    @GetMapping("/catalog")
    public ResponseEntity<Map<String, HardwareCatalog.Product>> getCatalog() {
        return ResponseEntity.ok(HardwareCatalog.getAll());
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, String>> checkout(
            @RequestBody ShopCheckoutRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        final String email = jwt.getClaimAsString("email");
        final String keycloakId = jwt.getSubject();

        final Map<String, String> result = shopService.createCheckoutSession(request, email, keycloakId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/orders")
    public ResponseEntity<List<HardwareOrderDto>> getOrders(@AuthenticationPrincipal Jwt jwt,org.springframework.security.core.Authentication authentication) {
        return ResponseEntity.ok(
            shopService.getOrders(jwt.getSubject(),manager(authentication)).stream()
                .map(HardwareOrderDto::from)
                .toList());
    }
    @GetMapping("/orders/{id}/operations")
    public List<com.clenzy.model.BaitlyCommerceOperation> operations(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt,org.springframework.security.core.Authentication authentication) {
        shopService.requireOrderAccess(id,jwt.getSubject(),manager(authentication));
        return operations.history(tenant.getRequiredOrganizationId(),"HARDWARE_ORDER",id);
    }
    @GetMapping("/orders/{id}/documents")
    public java.util.List<com.clenzy.service.BaitlySaleDocumentStore.View> documents(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt,org.springframework.security.core.Authentication auth){
        shopService.requireOrderAccess(id,jwt.getSubject(),manager(auth));
        return documents.list(tenant.getRequiredOrganizationId(),"HARDWARE_ORDER",id);
    }
    @GetMapping("/orders/{id}/documents/{document}/export")
    public java.util.Map<String,Object> exportDocument(@PathVariable Long id,@PathVariable Long document,@AuthenticationPrincipal Jwt jwt,org.springframework.security.core.Authentication auth){
        shopService.requireOrderAccess(id,jwt.getSubject(),manager(auth));
        return documents.export(tenant.getRequiredOrganizationId(),document,"HARDWARE_ORDER",id);
    }
    private static boolean manager(org.springframework.security.core.Authentication auth){return auth!=null && auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_SUPER_ADMIN") || a.getAuthority().equals("ROLE_SUPER_MANAGER"));}
}
