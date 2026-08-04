package com.clenzy.controller;

import com.clenzy.service.StayTransferService;
import com.clenzy.service.StayTransferService.PublicTransferView;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Page publique de la proposition de relogement (M11 v2) — le token UUID est
 * l'autorisation (comme le livret d'accueil : préfixe {@code /api/public/**}
 * déjà permitAll dans SecurityConfigProd, aucun changement de config sécurité).
 * Aucune donnée sensible dans le payload : prénom, noms de logements, dates.
 */
@RestController
@RequestMapping("/api/public/stay-transfers")
public class PublicStayTransferController {

    private final StayTransferService stayTransferService;

    public PublicStayTransferController(StayTransferService stayTransferService) {
        this.stayTransferService = stayTransferService;
    }

    @GetMapping("/{token}")
    @Operation(summary = "Proposition de relogement vue par le voyageur (token = autorisation)")
    public ResponseEntity<PublicTransferView> get(@PathVariable UUID token) {
        return ResponseEntity.ok(stayTransferService.getPublicView(token));
    }

    @PostMapping("/{token}/confirm")
    @Operation(summary = "Accord explicite du voyageur — exécute le relogement (CAS, idempotent)")
    public ResponseEntity<PublicTransferView> confirm(@PathVariable UUID token) {
        return ResponseEntity.ok(stayTransferService.confirm(token));
    }

    @PostMapping("/{token}/decline")
    @Operation(summary = "Refus du voyageur — la proposition est annulée, l'hôte prévenu")
    public ResponseEntity<PublicTransferView> decline(@PathVariable UUID token) {
        return ResponseEntity.ok(stayTransferService.decline(token));
    }
}
