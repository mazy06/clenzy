package com.clenzy.controller;

import com.clenzy.dto.HousekeeperRatesDto;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest;
import com.clenzy.model.User;
import com.clenzy.service.pricing.HousekeeperRateService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Tarifs prestataire ménage (Moteur Ménage 2A).
 * /me : le pro gère SES tarifs (ownership par keycloakId du JWT — jamais d'id en
 * paramètre). /user/{userId} : gestion par le staff plateforme. Controller mince
 * (règle ArchUnit) : délégation au service, aucune logique ni repository ici.
 */
@RestController
@RequestMapping("/api/housekeeper-rates")
@PreAuthorize("isAuthenticated()")
public class HousekeeperRateController {

    private final HousekeeperRateService housekeeperRateService;

    public HousekeeperRateController(HousekeeperRateService housekeeperRateService) {
        this.housekeeperRateService = housekeeperRateService;
    }

    /** Mes tarifs (taux horaire général + forfaits par logement + conseils). */
    @GetMapping("/me")
    public ResponseEntity<HousekeeperRatesDto> getMyRates(@AuthenticationPrincipal Jwt jwt) {
        User me = housekeeperRateService.requireCurrentUser(jwt.getSubject());
        return ResponseEntity.ok(housekeeperRateService.getRates(me.getId()));
    }

    /** Upsert de MES tarifs — le porteur du JWT ne peut modifier que les siens. */
    @PutMapping("/me")
    public ResponseEntity<HousekeeperRatesDto> updateMyRates(
            @RequestBody UpdateRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        User me = housekeeperRateService.requireCurrentUser(jwt.getSubject());
        return ResponseEntity.ok(housekeeperRateService.updateRates(me.getId(), request));
    }

    /** Tarifs d'un pro — gestion par le staff plateforme (admins / managers). */
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<HousekeeperRatesDto> getUserRates(@PathVariable Long userId) {
        return ResponseEntity.ok(housekeeperRateService.getRates(userId));
    }

    /** Upsert des tarifs d'un pro — staff plateforme. */
    @PutMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<HousekeeperRatesDto> updateUserRates(
            @PathVariable Long userId,
            @RequestBody UpdateRequest request) {
        return ResponseEntity.ok(housekeeperRateService.updateRates(userId, request));
    }
}
