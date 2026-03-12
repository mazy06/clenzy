package com.clenzy.controller;

import com.clenzy.dto.AiApiKeyTestResultDto;
import com.clenzy.dto.OrgAiApiKeyStatusDto;
import com.clenzy.dto.SaveAiApiKeyRequestDto;
import com.clenzy.service.OrgAiApiKeyService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Gestion des cles API IA par organisation (BYOK).
 *
 * Permet aux admins d'organisation de :
 * - Voir le status des providers (avec cles masquees)
 * - Tester une cle API avant de la sauvegarder
 * - Sauvegarder/mettre a jour une cle API
 * - Supprimer une cle pour revenir a la cle plateforme
 */
@RestController
@RequestMapping("/api/ai/keys")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class OrgAiApiKeyController {

    private final OrgAiApiKeyService orgAiApiKeyService;
    private final TenantContext tenantContext;

    public OrgAiApiKeyController(OrgAiApiKeyService orgAiApiKeyService,
                                  TenantContext tenantContext) {
        this.orgAiApiKeyService = orgAiApiKeyService;
        this.tenantContext = tenantContext;
    }

    /**
     * GET /api/ai/keys/status — Retourne le status des cles pour chaque provider.
     */
    @GetMapping("/status")
    public ResponseEntity<List<OrgAiApiKeyStatusDto>> getStatus() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(orgAiApiKeyService.getStatus(orgId));
    }

    /**
     * POST /api/ai/keys/test — Teste une cle API sans la sauvegarder.
     */
    @PostMapping("/test")
    public ResponseEntity<AiApiKeyTestResultDto> testKey(@Valid @RequestBody SaveAiApiKeyRequestDto request) {
        return ResponseEntity.ok(orgAiApiKeyService.testKey(request.provider(), request.apiKey()));
    }

    /**
     * PUT /api/ai/keys — Sauvegarde ou met a jour une cle API.
     */
    @PutMapping
    public ResponseEntity<OrgAiApiKeyStatusDto> saveKey(@Valid @RequestBody SaveAiApiKeyRequestDto request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        OrgAiApiKeyStatusDto result = orgAiApiKeyService.saveKey(
                orgId, request.provider(), request.apiKey(), request.modelOverride());
        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/ai/keys/{provider} — Supprime la cle de l'organisation pour un provider.
     */
    @DeleteMapping("/{provider}")
    public ResponseEntity<Map<String, String>> deleteKey(@PathVariable String provider) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        orgAiApiKeyService.deleteKey(orgId, provider);
        return ResponseEntity.ok(Map.of(
                "message", "Cle API supprimee. Retour a la cle plateforme.",
                "provider", provider
        ));
    }
}
