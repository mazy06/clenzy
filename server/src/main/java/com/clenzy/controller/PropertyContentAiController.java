package com.clenzy.controller;

import com.clenzy.booking.dto.GeneratedContentDto;
import com.clenzy.booking.service.PropertyContentAiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Génération IA de contenu pour une propriété (CLZ Domaine 2 — outils IA) : description + meta SEO,
 * multilingue. Controller mince : délégation au service (gating/budget/ownership côté service).
 */
@RestController
@RequestMapping("/api/properties")
@Tag(name = "Property Content AI", description = "Generation IA de contenu (descriptions, SEO)")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class PropertyContentAiController {

    private final PropertyContentAiService contentAiService;

    public PropertyContentAiController(PropertyContentAiService contentAiService) {
        this.contentAiService = contentAiService;
    }

    @PostMapping("/{id}/ai/description")
    @Operation(summary = "Generer une description commerciale du bien (fr/en/ar)")
    public ResponseEntity<GeneratedContentDto> generateDescription(
            @PathVariable Long id,
            @RequestParam(defaultValue = "fr") String language,
            @RequestParam(required = false) String tone) {
        return ResponseEntity.ok(contentAiService.generateDescription(id, language, tone));
    }

    @PostMapping("/{id}/ai/seo-meta")
    @Operation(summary = "Generer un titre SEO + meta description (fr/en/ar)")
    public ResponseEntity<GeneratedContentDto> generateSeoMeta(
            @PathVariable Long id,
            @RequestParam(defaultValue = "fr") String language) {
        return ResponseEntity.ok(contentAiService.generateSeoMeta(id, language));
    }
}
