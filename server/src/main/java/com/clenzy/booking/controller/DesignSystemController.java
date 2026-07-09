package com.clenzy.booking.controller;

import com.clenzy.booking.dto.DesignSystemCreateRequest;
import com.clenzy.booking.dto.DesignSystemDto;
import com.clenzy.booking.service.DesignSystemService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Systèmes de design réutilisables (direction : tokens {@code --bt-*} + {@code DESIGN.md} prose).
 * Lecture : catalogue global Baitly + systèmes privés de l'org. Création GLOBAL verrouillée au staff
 * plateforme dans le service ({@link DesignSystemService}).
 */
@RestController
@RequestMapping("/api/booking-engine/design-systems")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class DesignSystemController {

    private final DesignSystemService service;

    public DesignSystemController(DesignSystemService service) {
        this.service = service;
    }

    /** Systèmes visibles : catalogue global + ceux de l'org courante. */
    @GetMapping
    public ResponseEntity<List<DesignSystemDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<DesignSystemDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    /** Crée un système de design (source : MANUAL / BRAND / PASTE / URL). */
    @PostMapping
    public ResponseEntity<DesignSystemDto> create(@RequestBody DesignSystemCreateRequest req,
                                                  @AuthenticationPrincipal Jwt jwt) {
        String createdBy = jwt != null ? jwt.getSubject() : null;
        return ResponseEntity.ok(service.create(req, createdBy));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
