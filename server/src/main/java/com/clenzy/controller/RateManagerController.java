package com.clenzy.controller;

import com.clenzy.dto.rate.*;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.service.RateManagerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controller pour la gestion avancee des tarifs.
 *
 * Expose les endpoints pour :
 * - Calendrier tarifaire multi-channel
 * - CRUD des modifiers channel, remises LOS, tarification occupation, yield rules
 * - Distribution des tarifs vers les channels
 * - Mise a jour en masse
 * - Historique d'audit
 *
 * Controller mince (audit T-ARCH-01) : validation d'entree, delegation a
 * {@link RateManagerService} (acces donnees, transactions, validation d'org),
 * mapping DTO de reponse.
 */
@RestController
@RequestMapping("/api/rates")
@Tag(name = "Rate Manager", description = "Gestion avancee des tarifs et revenue management")
@PreAuthorize("isAuthenticated()")
public class RateManagerController {

    private final RateManagerService rateManagerService;

    public RateManagerController(RateManagerService rateManagerService) {
        this.rateManagerService = rateManagerService;
    }

    // ── Calendrier tarifaire ─────────────────────────────────────────────────

    @GetMapping("/calendar/{propertyId}")
    @Operation(summary = "Calendrier tarifaire multi-channel")
    public ResponseEntity<List<RateCalendarDto>> getRateCalendar(
            @PathVariable Long propertyId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.getRateCalendar(propertyId, from, to, jwt.getSubject()));
    }

    @GetMapping("/channel/{propertyId}/{channelName}")
    @Operation(summary = "Tarifs specifiques a un channel")
    public ResponseEntity<Map<LocalDate, BigDecimal>> getChannelRates(
            @PathVariable Long propertyId,
            @PathVariable ChannelName channelName,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.getChannelRates(
                propertyId, channelName, from, to, jwt.getSubject()));
    }

    // ── Distribution ─────────────────────────────────────────────────────────

    @PostMapping("/distribute/{propertyId}")
    @Operation(summary = "Distribuer les tarifs vers les channels connectes")
    public ResponseEntity<RateDistributionResultDto> distributeRates(
            @PathVariable Long propertyId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        Map<ChannelName, SyncResult> results = rateManagerService.distributeRates(
                propertyId, from, to, jwt.getSubject());

        Map<ChannelName, RateDistributionResultDto.ChannelSyncStatus> channelResults = results.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> RateDistributionResultDto.ChannelSyncStatus.from(e.getValue())
                ));

        return ResponseEntity.ok(new RateDistributionResultDto(propertyId, channelResults));
    }

    @PostMapping("/distribute/bulk")
    @Operation(summary = "Distribution en masse des tarifs")
    public ResponseEntity<Void> distributeBulk(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        rateManagerService.distributeBulkForCurrentOrganization(from, to);
        return ResponseEntity.accepted().build();
    }

    // ── Channel Rate Modifiers (CRUD) ────────────────────────────────────────

    @GetMapping("/modifiers/{propertyId}")
    @Operation(summary = "Modifiers channel pour une propriete")
    public ResponseEntity<List<ChannelRateModifierDto>> getModifiers(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.getModifiers(propertyId, jwt.getSubject()));
    }

    @PostMapping("/modifiers")
    @Operation(summary = "Creer un modifier channel")
    public ResponseEntity<ChannelRateModifierDto> createModifier(
            @RequestBody ChannelRateModifierDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.createModifier(dto, jwt.getSubject()));
    }

    @PutMapping("/modifiers/{id}")
    @Operation(summary = "Modifier un modifier channel")
    public ResponseEntity<ChannelRateModifierDto> updateModifier(
            @PathVariable Long id,
            @RequestBody ChannelRateModifierDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.updateModifier(id, dto, jwt.getSubject()));
    }

    @DeleteMapping("/modifiers/{id}")
    @Operation(summary = "Supprimer un modifier channel")
    public ResponseEntity<Void> deleteModifier(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        rateManagerService.deleteModifier(id, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    // ── Length of Stay Discounts (CRUD) ──────────────────────────────────────

    @GetMapping("/los-discounts/{propertyId}")
    @Operation(summary = "Remises duree de sejour pour une propriete")
    public ResponseEntity<List<LengthOfStayDiscountDto>> getLosDiscounts(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.getLosDiscounts(propertyId, jwt.getSubject()));
    }

    @PostMapping("/los-discounts")
    @Operation(summary = "Creer une remise duree de sejour")
    public ResponseEntity<LengthOfStayDiscountDto> createLosDiscount(
            @RequestBody LengthOfStayDiscountDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.createLosDiscount(dto, jwt.getSubject()));
    }

    @PutMapping("/los-discounts/{id}")
    @Operation(summary = "Modifier une remise duree de sejour")
    public ResponseEntity<LengthOfStayDiscountDto> updateLosDiscount(
            @PathVariable Long id,
            @RequestBody LengthOfStayDiscountDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.updateLosDiscount(id, dto, jwt.getSubject()));
    }

    @DeleteMapping("/los-discounts/{id}")
    @Operation(summary = "Supprimer une remise duree de sejour")
    public ResponseEntity<Void> deleteLosDiscount(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        rateManagerService.deleteLosDiscount(id, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    // ── Occupancy Pricing ────────────────────────────────────────────────────

    @GetMapping("/occupancy/{propertyId}")
    @Operation(summary = "Tarification par occupation pour une propriete")
    public ResponseEntity<OccupancyPricingDto> getOccupancyPricing(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        return rateManagerService.getOccupancyPricing(propertyId, jwt.getSubject())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PutMapping("/occupancy/{propertyId}")
    @Operation(summary = "Creer ou modifier la tarification par occupation")
    public ResponseEntity<OccupancyPricingDto> upsertOccupancyPricing(
            @PathVariable Long propertyId,
            @RequestBody OccupancyPricingDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.upsertOccupancyPricing(propertyId, dto, jwt.getSubject()));
    }

    // ── Yield Rules (CRUD) ───────────────────────────────────────────────────

    @GetMapping("/yield-rules/{propertyId}")
    @Operation(summary = "Regles de yield pour une propriete")
    public ResponseEntity<List<YieldRuleDto>> getYieldRules(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.getYieldRules(propertyId, jwt.getSubject()));
    }

    @PostMapping("/yield-rules")
    @Operation(summary = "Creer une regle de yield")
    public ResponseEntity<YieldRuleDto> createYieldRule(
            @RequestBody YieldRuleDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.createYieldRule(dto, jwt.getSubject()));
    }

    @PutMapping("/yield-rules/{id}")
    @Operation(summary = "Modifier une regle de yield")
    public ResponseEntity<YieldRuleDto> updateYieldRule(
            @PathVariable Long id,
            @RequestBody YieldRuleDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.updateYieldRule(id, dto, jwt.getSubject()));
    }

    @DeleteMapping("/yield-rules/{id}")
    @Operation(summary = "Supprimer une regle de yield")
    public ResponseEntity<Void> deleteYieldRule(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        rateManagerService.deleteYieldRule(id, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/yield-rules/evaluate/{propertyId}")
    @Operation(summary = "Evaluer manuellement les regles de yield")
    public ResponseEntity<Void> evaluateYieldRules(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        if (!rateManagerService.evaluateYieldRules(propertyId, jwt.getSubject())) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.accepted().build();
    }

    // ── Bulk Update ──────────────────────────────────────────────────────────

    @PostMapping("/bulk-update")
    @Operation(summary = "Mise a jour tarifaire en masse")
    public ResponseEntity<Void> bulkUpdate(
            @RequestBody BulkRateUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        rateManagerService.bulkUpdate(request, jwt.getSubject());
        return ResponseEntity.accepted().build();
    }

    // ── Audit Log ────────────────────────────────────────────────────────────

    @GetMapping("/audit-log/{propertyId}")
    @Operation(summary = "Historique des modifications tarifaires")
    public ResponseEntity<List<RateAuditLogDto>> getAuditLog(
            @PathVariable Long propertyId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateManagerService.getAuditLog(propertyId, from, to, jwt.getSubject()));
    }
}
