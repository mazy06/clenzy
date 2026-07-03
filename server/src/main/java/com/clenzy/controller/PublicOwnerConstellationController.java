package com.clenzy.controller;

import com.clenzy.dto.OwnerConstellationPublicDto;
import com.clenzy.service.OwnerConstellationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Constellation Proprietaire — endpoint PUBLIC en lecture seule (campagne X9 v1).
 *
 * <p>Sous {@code /api/public/**} (permitAll dans SecurityConfigProd, comme le
 * livret d'accueil {@link PublicGuideController}) : le token UUID revocable et
 * expirant est l'unique credential. 404 uniforme pour token inconnu / expire /
 * revoque — aucun oracle d'existence.</p>
 */
@RestController
@RequestMapping("/api/public/owner-constellation")
public class PublicOwnerConstellationController {

    private final OwnerConstellationService ownerConstellationService;

    public PublicOwnerConstellationController(OwnerConstellationService ownerConstellationService) {
        this.ownerConstellationService = ownerConstellationService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<OwnerConstellationPublicDto> getView(@PathVariable UUID token) {
        return ownerConstellationService.getPublicView(token)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
