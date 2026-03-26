package com.clenzy.controller;

import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareCatalog;
import com.clenzy.model.HardwareOrder;
import com.clenzy.service.ShopService;
import com.stripe.exception.StripeException;
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

    public ShopController(ShopService shopService) {
        this.shopService = shopService;
    }

    @GetMapping("/catalog")
    public ResponseEntity<Map<String, HardwareCatalog.Product>> getCatalog() {
        return ResponseEntity.ok(HardwareCatalog.getAll());
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, String>> checkout(
            @RequestBody ShopCheckoutRequest request,
            @AuthenticationPrincipal Jwt jwt) throws StripeException {
        final String email = jwt.getClaimAsString("email");
        final String keycloakId = jwt.getSubject();

        final Map<String, String> result = shopService.createCheckoutSession(request, email, keycloakId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/orders")
    public ResponseEntity<List<HardwareOrder>> getOrders() {
        return ResponseEntity.ok(shopService.getOrders());
    }
}
