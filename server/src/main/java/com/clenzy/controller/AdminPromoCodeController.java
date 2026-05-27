package com.clenzy.controller;

import com.clenzy.model.PromoCode;
import com.clenzy.repository.PromoCodeRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Administration des codes promo (SUPER_ADMIN uniquement).
 *
 * <p>Pas d'UI pour le moment — les codes sont crees via cet endpoint en attendant
 * un ecran admin dedie. Le DTO accepte est un Map simple pour minimiser la
 * surface : seul SUPER_ADMIN y a acces, et la validation cote service refuse
 * deja les valeurs hors plage.</p>
 */
@RestController
@RequestMapping("/api/admin/promo-codes")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@Tag(name = "Admin - Promo Codes", description = "CRUD des codes promo (admin uniquement)")
public class AdminPromoCodeController {

    private final PromoCodeRepository repository;

    public AdminPromoCodeController(PromoCodeRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Operation(summary = "Lister tous les codes promo")
    public ResponseEntity<List<PromoCode>> list() {
        return ResponseEntity.ok(repository.findAll());
    }

    @PostMapping
    @Operation(summary = "Creer un nouveau code promo")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body,
                                     @AuthenticationPrincipal Jwt jwt) {
        try {
            String code = (String) body.get("code");
            if (code == null || code.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Le code est requis."));
            }

            PromoCode promo = new PromoCode();
            promo.setCode(code);
            String type = (String) body.getOrDefault("discountType", "PERCENTAGE");
            promo.setDiscountType(PromoCode.DiscountType.valueOf(type));

            Object value = body.get("discountValue");
            if (!(value instanceof Number)) {
                return ResponseEntity.badRequest().body(Map.of("error", "discountValue requis (entier)."));
            }
            promo.setDiscountValue(((Number) value).intValue());

            if (body.get("maxUses") instanceof Number n) {
                promo.setMaxUses(n.intValue());
            }
            if (body.get("validFrom") instanceof String s && !s.isBlank()) {
                promo.setValidFrom(LocalDateTime.parse(s));
            }
            if (body.get("validUntil") instanceof String s && !s.isBlank()) {
                promo.setValidUntil(LocalDateTime.parse(s));
            }
            if (body.get("description") instanceof String s) {
                promo.setDescription(s);
            }
            promo.setCreatedBy(jwt.getSubject());

            // Validation cote entity (% range, type, etc.) via JPA constraints
            PromoCode saved = repository.save(promo);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/activate")
    @Operation(summary = "(Re)activer un code promo")
    public ResponseEntity<?> activate(@PathVariable Long id) {
        return repository.findById(id)
                .map(promo -> {
                    promo.setActive(true);
                    return ResponseEntity.ok((Object) repository.save(promo));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/deactivate")
    @Operation(summary = "Desactiver un code promo")
    public ResponseEntity<?> deactivate(@PathVariable Long id) {
        return repository.findById(id)
                .map(promo -> {
                    promo.setActive(false);
                    return ResponseEntity.ok((Object) repository.save(promo));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
