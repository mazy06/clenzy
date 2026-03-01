package com.clenzy.controller;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.service.FiscalProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller REST pour la gestion du profil fiscal de l'organisation courante.
 *
 * Endpoints :
 * - GET  /api/fiscal-profile       → profil fiscal courant
 * - PUT  /api/fiscal-profile       → mise a jour du profil fiscal
 */
@RestController
@RequestMapping("/api/fiscal-profile")
public class FiscalProfileController {

    private final FiscalProfileService fiscalProfileService;

    public FiscalProfileController(FiscalProfileService fiscalProfileService) {
        this.fiscalProfileService = fiscalProfileService;
    }

    /**
     * Retourne le profil fiscal de l'organisation courante.
     * Auto-cree le profil avec des valeurs par defaut s'il n'existe pas.
     */
    @GetMapping
    public ResponseEntity<FiscalProfileDto> getCurrentProfile() {
        return ResponseEntity.ok(fiscalProfileService.getCurrentProfile());
    }

    /**
     * Met a jour le profil fiscal de l'organisation courante.
     */
    @PutMapping
    public ResponseEntity<FiscalProfileDto> updateProfile(@RequestBody FiscalProfileDto dto) {
        return ResponseEntity.ok(fiscalProfileService.updateProfile(dto));
    }
}
