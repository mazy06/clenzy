package com.clenzy.booking.controller;

import com.clenzy.booking.dto.SiteTemplateCreateRequest;
import com.clenzy.booking.dto.SiteTemplateDto;
import com.clenzy.booking.service.SiteTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Catalogue de templates de site (galerie « Choisir un design » du Studio).
 * Lecture : catalogue global Clenzy + templates privés de l'org. Création/suppression : la portée
 * GLOBAL est verrouillée au staff plateforme dans le service (cf. {@link SiteTemplateService}).
 */
@RestController
@RequestMapping("/api/booking-engine/site-templates")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class SiteTemplateController {

    private final SiteTemplateService service;

    public SiteTemplateController(SiteTemplateService service) {
        this.service = service;
    }

    /** Templates visibles : catalogue global + ceux de l'org courante. */
    @GetMapping
    public ResponseEntity<List<SiteTemplateDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    /** Enregistre le design courant comme template (scope ORG par défaut, GLOBAL = staff plateforme). */
    @PostMapping
    public ResponseEntity<SiteTemplateDto> create(@RequestBody SiteTemplateCreateRequest req,
                                                  @AuthenticationPrincipal Jwt jwt) {
        String createdBy = jwt != null ? jwt.getSubject() : null;
        return ResponseEntity.ok(service.create(req, createdBy));
    }

    /** Modifie un template (métadonnées ; le contenu n'est remplacé que s'il est fourni). */
    @PutMapping("/{id}")
    public ResponseEntity<SiteTemplateDto> update(@PathVariable Long id, @RequestBody SiteTemplateCreateRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
