package com.clenzy.controller;

import com.clenzy.service.StayModificationService;
import com.clenzy.service.StayModificationService.PublicModificationView;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Page publique de l'avenant de séjour (STAY_MODIFICATION v2) — même modèle que
 * le relogement : token UUID = autorisation, préfixe {@code /api/public/**} déjà
 * permitAll (aucun changement SecurityConfigProd). Payload sans donnée sensible.
 */
@RestController
@RequestMapping("/api/public/stay-modifications")
public class PublicStayModificationController {

    private final StayModificationService stayModificationService;

    public PublicStayModificationController(StayModificationService stayModificationService) {
        this.stayModificationService = stayModificationService;
    }

    @GetMapping("/{token}")
    @Operation(summary = "Proposition d'avenant vue par le voyageur (token = autorisation)")
    public ResponseEntity<PublicModificationView> get(@PathVariable UUID token) {
        return ResponseEntity.ok(stayModificationService.getPublicView(token));
    }

    @PostMapping("/{token}/confirm")
    @Operation(summary = "Accord explicite du voyageur — applique l'avenant (CAS, tarif re-vérifié)")
    public ResponseEntity<PublicModificationView> confirm(@PathVariable UUID token) {
        return ResponseEntity.ok(stayModificationService.confirm(token));
    }

    @PostMapping("/{token}/decline")
    @Operation(summary = "Refus du voyageur — la proposition est annulée, l'hôte prévenu")
    public ResponseEntity<PublicModificationView> decline(@PathVariable UUID token) {
        return ResponseEntity.ok(stayModificationService.decline(token));
    }
}
