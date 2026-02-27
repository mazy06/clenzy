package com.clenzy.controller;

import com.clenzy.dto.rate.*;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.AdvancedRateManager;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.RateDistributionService;
import com.clenzy.service.YieldManagementScheduler;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
 */
@RestController
@RequestMapping("/api/rates")
@Tag(name = "Rate Manager", description = "Gestion avancee des tarifs et revenue management")
@PreAuthorize("isAuthenticated()")
public class RateManagerController {

    private static final Logger log = LoggerFactory.getLogger(RateManagerController.class);

    private final AdvancedRateManager advancedRateManager;
    private final RateDistributionService rateDistributionService;
    private final YieldManagementScheduler yieldManagementScheduler;
    private final PriceEngine priceEngine;
    private final ChannelRateModifierRepository channelRateModifierRepository;
    private final LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    private final OccupancyPricingRepository occupancyPricingRepository;
    private final YieldRuleRepository yieldRuleRepository;
    private final RateAuditLogRepository rateAuditLogRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public RateManagerController(AdvancedRateManager advancedRateManager,
                                 RateDistributionService rateDistributionService,
                                 YieldManagementScheduler yieldManagementScheduler,
                                 PriceEngine priceEngine,
                                 ChannelRateModifierRepository channelRateModifierRepository,
                                 LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                                 OccupancyPricingRepository occupancyPricingRepository,
                                 YieldRuleRepository yieldRuleRepository,
                                 RateAuditLogRepository rateAuditLogRepository,
                                 RateOverrideRepository rateOverrideRepository,
                                 PropertyRepository propertyRepository,
                                 UserRepository userRepository,
                                 TenantContext tenantContext) {
        this.advancedRateManager = advancedRateManager;
        this.rateDistributionService = rateDistributionService;
        this.yieldManagementScheduler = yieldManagementScheduler;
        this.priceEngine = priceEngine;
        this.channelRateModifierRepository = channelRateModifierRepository;
        this.lengthOfStayDiscountRepository = lengthOfStayDiscountRepository;
        this.occupancyPricingRepository = occupancyPricingRepository;
        this.yieldRuleRepository = yieldRuleRepository;
        this.rateAuditLogRepository = rateAuditLogRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    // ── Calendrier tarifaire ─────────────────────────────────────────────────

    @GetMapping("/calendar/{propertyId}")
    @Operation(summary = "Calendrier tarifaire multi-channel")
    public ResponseEntity<List<RateCalendarDto>> getRateCalendar(
            @PathVariable Long propertyId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<RateCalendarDto> calendar = advancedRateManager.getRateCalendar(propertyId, from, to, orgId);
        return ResponseEntity.ok(calendar);
    }

    @GetMapping("/channel/{propertyId}/{channelName}")
    @Operation(summary = "Tarifs specifiques a un channel")
    public ResponseEntity<Map<LocalDate, BigDecimal>> getChannelRates(
            @PathVariable Long propertyId,
            @PathVariable ChannelName channelName,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Map<LocalDate, BigDecimal> prices = advancedRateManager
                .resolveChannelPriceRange(propertyId, from, to, channelName, orgId);
        return ResponseEntity.ok(prices);
    }

    // ── Distribution ─────────────────────────────────────────────────────────

    @PostMapping("/distribute/{propertyId}")
    @Operation(summary = "Distribuer les tarifs vers les channels connectes")
    public ResponseEntity<RateDistributionResultDto> distributeRates(
            @PathVariable Long propertyId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Map<ChannelName, SyncResult> results = rateDistributionService.distributeRates(propertyId, from, to, orgId);

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

        Long orgId = tenantContext.getRequiredOrganizationId();
        rateDistributionService.distributeRatesForAllProperties(orgId, from, to);
        return ResponseEntity.accepted().build();
    }

    // ── Channel Rate Modifiers (CRUD) ────────────────────────────────────────

    @GetMapping("/modifiers/{propertyId}")
    @Operation(summary = "Modifiers channel pour une propriete")
    public ResponseEntity<List<ChannelRateModifierDto>> getModifiers(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<ChannelRateModifierDto> result = channelRateModifierRepository
                .findActiveByPropertyId(propertyId, orgId).stream()
                .map(this::toModifierDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/modifiers")
    @Operation(summary = "Creer un modifier channel")
    public ResponseEntity<ChannelRateModifierDto> createModifier(
            @RequestBody ChannelRateModifierDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        if (dto.propertyId() != null) {
            validatePropertyAccess(dto.propertyId(), jwt.getSubject());
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        ChannelRateModifier modifier = fromModifierDto(dto, orgId);
        ChannelRateModifier saved = channelRateModifierRepository.save(modifier);
        return ResponseEntity.ok(toModifierDto(saved));
    }

    @PutMapping("/modifiers/{id}")
    @Operation(summary = "Modifier un modifier channel")
    public ResponseEntity<ChannelRateModifierDto> updateModifier(
            @PathVariable Long id,
            @RequestBody ChannelRateModifierDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        ChannelRateModifier existing = channelRateModifierRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Modifier non trouve: " + id));

        if (existing.getProperty() != null) {
            validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());
        }

        if (dto.channelName() != null) existing.setChannelName(ChannelName.valueOf(dto.channelName()));
        if (dto.modifierType() != null) existing.setModifierType(ChannelRateModifier.ModifierType.valueOf(dto.modifierType()));
        if (dto.modifierValue() != null) existing.setModifierValue(dto.modifierValue());
        if (dto.description() != null) existing.setDescription(dto.description());
        if (dto.isActive() != null) existing.setActive(dto.isActive());
        if (dto.priority() != null) existing.setPriority(dto.priority());
        if (dto.startDate() != null) existing.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) existing.setEndDate(LocalDate.parse(dto.endDate()));

        ChannelRateModifier saved = channelRateModifierRepository.save(existing);
        return ResponseEntity.ok(toModifierDto(saved));
    }

    @DeleteMapping("/modifiers/{id}")
    @Operation(summary = "Supprimer un modifier channel")
    public ResponseEntity<Void> deleteModifier(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        ChannelRateModifier existing = channelRateModifierRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Modifier non trouve: " + id));

        if (existing.getProperty() != null) {
            validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());
        }

        channelRateModifierRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    // ── Length of Stay Discounts (CRUD) ──────────────────────────────────────

    @GetMapping("/los-discounts/{propertyId}")
    @Operation(summary = "Remises duree de sejour pour une propriete")
    public ResponseEntity<List<LengthOfStayDiscountDto>> getLosDiscounts(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<LengthOfStayDiscountDto> result = lengthOfStayDiscountRepository
                .findByPropertyId(propertyId, orgId).stream()
                .map(this::toLosDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/los-discounts")
    @Operation(summary = "Creer une remise duree de sejour")
    public ResponseEntity<LengthOfStayDiscountDto> createLosDiscount(
            @RequestBody LengthOfStayDiscountDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        if (dto.propertyId() != null) {
            validatePropertyAccess(dto.propertyId(), jwt.getSubject());
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        LengthOfStayDiscount discount = fromLosDto(dto, orgId);
        LengthOfStayDiscount saved = lengthOfStayDiscountRepository.save(discount);
        return ResponseEntity.ok(toLosDto(saved));
    }

    @PutMapping("/los-discounts/{id}")
    @Operation(summary = "Modifier une remise duree de sejour")
    public ResponseEntity<LengthOfStayDiscountDto> updateLosDiscount(
            @PathVariable Long id,
            @RequestBody LengthOfStayDiscountDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        LengthOfStayDiscount existing = lengthOfStayDiscountRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Remise LOS non trouvee: " + id));

        if (existing.getProperty() != null) {
            validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());
        }

        existing.setMinNights(dto.minNights());
        if (dto.maxNights() != null) existing.setMaxNights(dto.maxNights());
        if (dto.discountType() != null) existing.setDiscountType(LengthOfStayDiscount.DiscountType.valueOf(dto.discountType()));
        if (dto.discountValue() != null) existing.setDiscountValue(dto.discountValue());
        if (dto.isActive() != null) existing.setActive(dto.isActive());
        if (dto.startDate() != null) existing.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) existing.setEndDate(LocalDate.parse(dto.endDate()));

        LengthOfStayDiscount saved = lengthOfStayDiscountRepository.save(existing);
        return ResponseEntity.ok(toLosDto(saved));
    }

    @DeleteMapping("/los-discounts/{id}")
    @Operation(summary = "Supprimer une remise duree de sejour")
    public ResponseEntity<Void> deleteLosDiscount(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        LengthOfStayDiscount existing = lengthOfStayDiscountRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Remise LOS non trouvee: " + id));

        if (existing.getProperty() != null) {
            validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());
        }

        lengthOfStayDiscountRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    // ── Occupancy Pricing ────────────────────────────────────────────────────

    @GetMapping("/occupancy/{propertyId}")
    @Operation(summary = "Tarification par occupation pour une propriete")
    public ResponseEntity<OccupancyPricingDto> getOccupancyPricing(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        return occupancyPricingRepository.findByPropertyId(propertyId, orgId)
                .map(this::toOccupancyDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PutMapping("/occupancy/{propertyId}")
    @Operation(summary = "Creer ou modifier la tarification par occupation")
    public ResponseEntity<OccupancyPricingDto> upsertOccupancyPricing(
            @PathVariable Long propertyId,
            @RequestBody OccupancyPricingDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        OccupancyPricing pricing = occupancyPricingRepository
                .findByPropertyId(propertyId, orgId)
                .orElseGet(() -> {
                    OccupancyPricing newPricing = new OccupancyPricing();
                    newPricing.setOrganizationId(orgId);
                    newPricing.setProperty(property);
                    return newPricing;
                });

        pricing.setBaseOccupancy(dto.baseOccupancy());
        pricing.setExtraGuestFee(dto.extraGuestFee());
        pricing.setMaxOccupancy(dto.maxOccupancy());
        if (dto.childDiscount() != null) pricing.setChildDiscount(dto.childDiscount());
        if (dto.isActive() != null) pricing.setActive(dto.isActive());

        OccupancyPricing saved = occupancyPricingRepository.save(pricing);
        return ResponseEntity.ok(toOccupancyDto(saved));
    }

    // ── Yield Rules (CRUD) ───────────────────────────────────────────────────

    @GetMapping("/yield-rules/{propertyId}")
    @Operation(summary = "Regles de yield pour une propriete")
    public ResponseEntity<List<YieldRuleDto>> getYieldRules(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<YieldRuleDto> result = yieldRuleRepository
                .findAllByPropertyId(propertyId, orgId).stream()
                .map(this::toYieldRuleDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/yield-rules")
    @Operation(summary = "Creer une regle de yield")
    public ResponseEntity<YieldRuleDto> createYieldRule(
            @RequestBody YieldRuleDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        if (dto.propertyId() != null) {
            validatePropertyAccess(dto.propertyId(), jwt.getSubject());
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        YieldRule rule = fromYieldRuleDto(dto, orgId);
        YieldRule saved = yieldRuleRepository.save(rule);
        return ResponseEntity.ok(toYieldRuleDto(saved));
    }

    @PutMapping("/yield-rules/{id}")
    @Operation(summary = "Modifier une regle de yield")
    public ResponseEntity<YieldRuleDto> updateYieldRule(
            @PathVariable Long id,
            @RequestBody YieldRuleDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        YieldRule existing = yieldRuleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Regle yield non trouvee: " + id));

        if (existing.getProperty() != null) {
            validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());
        }

        if (dto.name() != null) existing.setName(dto.name());
        if (dto.ruleType() != null) existing.setRuleType(YieldRule.RuleType.valueOf(dto.ruleType()));
        if (dto.triggerCondition() != null) existing.setTriggerCondition(dto.triggerCondition());
        if (dto.adjustmentType() != null) existing.setAdjustmentType(YieldRule.AdjustmentType.valueOf(dto.adjustmentType()));
        if (dto.adjustmentValue() != null) existing.setAdjustmentValue(dto.adjustmentValue());
        existing.setMinPrice(dto.minPrice());
        existing.setMaxPrice(dto.maxPrice());
        if (dto.isActive() != null) existing.setActive(dto.isActive());
        if (dto.priority() != null) existing.setPriority(dto.priority());

        YieldRule saved = yieldRuleRepository.save(existing);
        return ResponseEntity.ok(toYieldRuleDto(saved));
    }

    @DeleteMapping("/yield-rules/{id}")
    @Operation(summary = "Supprimer une regle de yield")
    public ResponseEntity<Void> deleteYieldRule(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        YieldRule existing = yieldRuleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Regle yield non trouvee: " + id));

        if (existing.getProperty() != null) {
            validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());
        }

        yieldRuleRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/yield-rules/evaluate/{propertyId}")
    @Operation(summary = "Evaluer manuellement les regles de yield")
    public ResponseEntity<Void> evaluateYieldRules(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        yieldManagementScheduler.evaluateForProperty(propertyId, orgId);
        return ResponseEntity.accepted().build();
    }

    // ── Bulk Update ──────────────────────────────────────────────────────────

    @PostMapping("/bulk-update")
    @Operation(summary = "Mise a jour tarifaire en masse")
    public ResponseEntity<Void> bulkUpdate(
            @RequestBody BulkRateUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();

        for (Long propertyId : request.propertyIds()) {
            validatePropertyAccess(propertyId, jwt.getSubject());

            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

            for (LocalDate date = request.from(); !date.isAfter(request.to()); date = date.plusDays(1)) {
                BigDecimal currentPrice = priceEngine.resolvePrice(propertyId, date, orgId);
                if (currentPrice == null) continue;

                BigDecimal newPrice = calculateBulkAdjustedPrice(currentPrice, request);
                RateOverride override = new RateOverride(property, date, newPrice, "MANUAL", orgId);
                override.setCreatedBy(jwt.getSubject());
                rateOverrideRepository.save(override);

                // Audit log
                RateAuditLog auditLog = new RateAuditLog(
                        orgId, propertyId, date,
                        currentPrice, newPrice,
                        "MANUAL", jwt.getSubject(), null
                );
                rateAuditLogRepository.save(auditLog);
            }
        }

        return ResponseEntity.accepted().build();
    }

    // ── Audit Log ────────────────────────────────────────────────────────────

    @GetMapping("/audit-log/{propertyId}")
    @Operation(summary = "Historique des modifications tarifaires")
    public ResponseEntity<List<RateAuditLog>> getAuditLog(
            @PathVariable Long propertyId,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<RateAuditLog> logs = rateAuditLogRepository
                .findByPropertyIdAndDateRange(propertyId, from, to, orgId);
        return ResponseEntity.ok(logs);
    }

    // ── Mappers ──────────────────────────────────────────────────────────────

    private ChannelRateModifierDto toModifierDto(ChannelRateModifier entity) {
        return new ChannelRateModifierDto(
                entity.getId(),
                entity.getProperty() != null ? entity.getProperty().getId() : null,
                entity.getChannelName() != null ? entity.getChannelName().name() : null,
                entity.getModifierType() != null ? entity.getModifierType().name() : null,
                entity.getModifierValue(),
                entity.getDescription(),
                entity.isActive(),
                entity.getPriority(),
                entity.getStartDate() != null ? entity.getStartDate().toString() : null,
                entity.getEndDate() != null ? entity.getEndDate().toString() : null
        );
    }

    private ChannelRateModifier fromModifierDto(ChannelRateModifierDto dto, Long orgId) {
        ChannelRateModifier modifier = new ChannelRateModifier();
        modifier.setOrganizationId(orgId);
        if (dto.propertyId() != null) {
            Property property = propertyRepository.findById(dto.propertyId())
                    .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));
            modifier.setProperty(property);
        }
        modifier.setChannelName(ChannelName.valueOf(dto.channelName()));
        modifier.setModifierType(ChannelRateModifier.ModifierType.valueOf(dto.modifierType()));
        modifier.setModifierValue(dto.modifierValue());
        modifier.setDescription(dto.description());
        modifier.setActive(dto.isActive() != null ? dto.isActive() : true);
        modifier.setPriority(dto.priority() != null ? dto.priority() : 0);
        if (dto.startDate() != null) modifier.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) modifier.setEndDate(LocalDate.parse(dto.endDate()));
        return modifier;
    }

    private LengthOfStayDiscountDto toLosDto(LengthOfStayDiscount entity) {
        return new LengthOfStayDiscountDto(
                entity.getId(),
                entity.getProperty() != null ? entity.getProperty().getId() : null,
                entity.getMinNights(),
                entity.getMaxNights(),
                entity.getDiscountType() != null ? entity.getDiscountType().name() : null,
                entity.getDiscountValue(),
                entity.isActive(),
                entity.getStartDate() != null ? entity.getStartDate().toString() : null,
                entity.getEndDate() != null ? entity.getEndDate().toString() : null
        );
    }

    private LengthOfStayDiscount fromLosDto(LengthOfStayDiscountDto dto, Long orgId) {
        LengthOfStayDiscount discount = new LengthOfStayDiscount();
        discount.setOrganizationId(orgId);
        if (dto.propertyId() != null) {
            Property property = propertyRepository.findById(dto.propertyId())
                    .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));
            discount.setProperty(property);
        }
        discount.setMinNights(dto.minNights());
        discount.setMaxNights(dto.maxNights());
        discount.setDiscountType(LengthOfStayDiscount.DiscountType.valueOf(dto.discountType()));
        discount.setDiscountValue(dto.discountValue());
        discount.setActive(dto.isActive() != null ? dto.isActive() : true);
        if (dto.startDate() != null) discount.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) discount.setEndDate(LocalDate.parse(dto.endDate()));
        return discount;
    }

    private OccupancyPricingDto toOccupancyDto(OccupancyPricing entity) {
        return new OccupancyPricingDto(
                entity.getId(),
                entity.getProperty() != null ? entity.getProperty().getId() : null,
                entity.getBaseOccupancy(),
                entity.getExtraGuestFee(),
                entity.getMaxOccupancy(),
                entity.getChildDiscount(),
                entity.isActive()
        );
    }

    private YieldRuleDto toYieldRuleDto(YieldRule entity) {
        return new YieldRuleDto(
                entity.getId(),
                entity.getProperty() != null ? entity.getProperty().getId() : null,
                entity.getName(),
                entity.getRuleType() != null ? entity.getRuleType().name() : null,
                entity.getTriggerCondition(),
                entity.getAdjustmentType() != null ? entity.getAdjustmentType().name() : null,
                entity.getAdjustmentValue(),
                entity.getMinPrice(),
                entity.getMaxPrice(),
                entity.isActive(),
                entity.getPriority()
        );
    }

    private YieldRule fromYieldRuleDto(YieldRuleDto dto, Long orgId) {
        YieldRule rule = new YieldRule();
        rule.setOrganizationId(orgId);
        if (dto.propertyId() != null) {
            Property property = propertyRepository.findById(dto.propertyId())
                    .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));
            rule.setProperty(property);
        }
        rule.setName(dto.name());
        rule.setRuleType(YieldRule.RuleType.valueOf(dto.ruleType()));
        rule.setTriggerCondition(dto.triggerCondition());
        rule.setAdjustmentType(YieldRule.AdjustmentType.valueOf(dto.adjustmentType()));
        rule.setAdjustmentValue(dto.adjustmentValue());
        rule.setMinPrice(dto.minPrice());
        rule.setMaxPrice(dto.maxPrice());
        rule.setActive(dto.isActive() != null ? dto.isActive() : true);
        rule.setPriority(dto.priority() != null ? dto.priority() : 0);
        return rule;
    }

    private BigDecimal calculateBulkAdjustedPrice(BigDecimal currentPrice, BulkRateUpdateRequest request) {
        return switch (request.priceAdjustmentType()) {
            case "PERCENTAGE" -> {
                BigDecimal adj = currentPrice.multiply(request.priceAdjustmentValue())
                        .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
                yield currentPrice.add(adj).max(BigDecimal.ZERO);
            }
            case "FIXED" -> currentPrice.add(request.priceAdjustmentValue()).max(BigDecimal.ZERO);
            default -> currentPrice;
        };
    }

    // ── Ownership validation ─────────────────────────────────────────────────

    private void validatePropertyAccess(Long propertyId, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }
        if (tenantContext.isSuperAdmin()) return;

        var user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) return;

        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
