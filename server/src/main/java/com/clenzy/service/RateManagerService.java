package com.clenzy.service;

import com.clenzy.dto.rate.BulkRateUpdateRequest;
import com.clenzy.dto.rate.ChannelRateModifierDto;
import com.clenzy.dto.rate.LengthOfStayDiscountDto;
import com.clenzy.dto.rate.OccupancyPricingDto;
import com.clenzy.dto.rate.RateAuditLogDto;
import com.clenzy.dto.rate.RateCalendarDto;
import com.clenzy.dto.rate.YieldRuleDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelRateModifier;
import com.clenzy.model.LengthOfStayDiscount;
import com.clenzy.model.OccupancyPricing;
import com.clenzy.model.Property;
import com.clenzy.model.RateAuditLog;
import com.clenzy.model.RateOverride;
import com.clenzy.model.YieldRule;
import com.clenzy.repository.ChannelRateModifierRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateAuditLogRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.YieldRuleRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service applicatif du Rate Manager (calendrier multi-channel, CRUD des
 * regles tarifaires, distribution, bulk update, audit).
 *
 * Logique deplacee de RateManagerController (audit T-ARCH-01 : controller
 * mince — acces donnees, transactions et validation d'org au niveau service).
 *
 * L'acces propriete est valide par la regle transverse unique
 * {@link ReservationService#validatePropertyAccess(Long, String)}
 * (org courante + super admin + platform staff + owner — pattern T-ARCH-08).
 *
 * Controle ajoute par ce refactor (CLAUDE.md « Lecons », regle 3) : les
 * regles SANS propriete porteuse (modifiers/remises/yield rules org-wide)
 * etaient modifiables/supprimables par ID sans aucune validation d'org —
 * findById contourne le filtre Hibernate. Elles passent desormais par
 * {@link #requireSameOrganization(Long, String)} (pattern SmartLockService,
 * bypass platform staff inclus).
 */
@Service
public class RateManagerService {

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
    private final ReservationService reservationService;
    private final TenantContext tenantContext;
    private final com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    public RateManagerService(AdvancedRateManager advancedRateManager,
                              RateDistributionService rateDistributionService,
                              @Nullable YieldManagementScheduler yieldManagementScheduler,
                              PriceEngine priceEngine,
                              ChannelRateModifierRepository channelRateModifierRepository,
                              LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                              OccupancyPricingRepository occupancyPricingRepository,
                              YieldRuleRepository yieldRuleRepository,
                              RateAuditLogRepository rateAuditLogRepository,
                              RateOverrideRepository rateOverrideRepository,
                              PropertyRepository propertyRepository,
                              ReservationService reservationService,
                              TenantContext tenantContext,
                              com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard) {
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
        this.reservationService = reservationService;
        this.tenantContext = tenantContext;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    // ── Calendrier tarifaire ─────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RateCalendarDto> getRateCalendar(Long propertyId, LocalDate from,
                                                 LocalDate to, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();
        return advancedRateManager.getRateCalendar(propertyId, from, to, orgId);
    }

    @Transactional(readOnly = true)
    public Map<LocalDate, BigDecimal> getChannelRates(Long propertyId, ChannelName channelName,
                                                      LocalDate from, LocalDate to, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();
        return advancedRateManager.resolveChannelPriceRange(propertyId, from, to, channelName, orgId);
    }

    // ── Distribution ─────────────────────────────────────────────────────────
    // Pas de @Transactional : la distribution declenche des appels externes
    // vers les channels (CLAUDE.md « Lecons », regle 2 — jamais d'appel HTTP
    // externe dans une transaction DB).

    public Map<ChannelName, SyncResult> distributeRates(Long propertyId, LocalDate from,
                                                        LocalDate to, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();
        return rateDistributionService.distributeRates(propertyId, from, to, orgId);
    }

    public void distributeBulkForCurrentOrganization(LocalDate from, LocalDate to) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        rateDistributionService.distributeRatesForAllProperties(orgId, from, to);
    }

    // ── Channel Rate Modifiers ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ChannelRateModifierDto> getModifiers(Long propertyId, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return channelRateModifierRepository.findActiveByPropertyId(propertyId, orgId).stream()
                .map(this::toModifierDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ChannelRateModifierDto createModifier(ChannelRateModifierDto dto, String keycloakId) {
        if (dto.propertyId() != null) {
            reservationService.validatePropertyAccess(dto.propertyId(), keycloakId);
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        ChannelRateModifier saved = channelRateModifierRepository.save(fromModifierDto(dto, orgId));
        return toModifierDto(saved);
    }

    @Transactional
    public ChannelRateModifierDto updateModifier(Long id, ChannelRateModifierDto dto, String keycloakId) {
        ChannelRateModifier existing = channelRateModifierRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Modifier non trouve: " + id));
        requireRuleAccess(existing.getProperty(), existing.getOrganizationId(), keycloakId);

        if (dto.channelName() != null) existing.setChannelName(ChannelName.valueOf(dto.channelName()));
        if (dto.modifierType() != null) existing.setModifierType(ChannelRateModifier.ModifierType.valueOf(dto.modifierType()));
        if (dto.modifierValue() != null) existing.setModifierValue(dto.modifierValue());
        if (dto.description() != null) existing.setDescription(dto.description());
        if (dto.isActive() != null) existing.setActive(dto.isActive());
        if (dto.priority() != null) existing.setPriority(dto.priority());
        if (dto.startDate() != null) existing.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) existing.setEndDate(LocalDate.parse(dto.endDate()));

        return toModifierDto(channelRateModifierRepository.save(existing));
    }

    @Transactional
    public void deleteModifier(Long id, String keycloakId) {
        ChannelRateModifier existing = channelRateModifierRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Modifier non trouve: " + id));
        requireRuleAccess(existing.getProperty(), existing.getOrganizationId(), keycloakId);

        channelRateModifierRepository.delete(existing);
    }

    // ── Length of Stay Discounts ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<LengthOfStayDiscountDto> getLosDiscounts(Long propertyId, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return lengthOfStayDiscountRepository.findByPropertyId(propertyId, orgId).stream()
                .map(this::toLosDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public LengthOfStayDiscountDto createLosDiscount(LengthOfStayDiscountDto dto, String keycloakId) {
        if (dto.propertyId() != null) {
            reservationService.validatePropertyAccess(dto.propertyId(), keycloakId);
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        LengthOfStayDiscount saved = lengthOfStayDiscountRepository.save(fromLosDto(dto, orgId));
        return toLosDto(saved);
    }

    @Transactional
    public LengthOfStayDiscountDto updateLosDiscount(Long id, LengthOfStayDiscountDto dto, String keycloakId) {
        LengthOfStayDiscount existing = lengthOfStayDiscountRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Remise LOS non trouvee: " + id));
        requireRuleAccess(existing.getProperty(), existing.getOrganizationId(), keycloakId);

        existing.setMinNights(dto.minNights());
        if (dto.maxNights() != null) existing.setMaxNights(dto.maxNights());
        if (dto.discountType() != null) existing.setDiscountType(LengthOfStayDiscount.DiscountType.valueOf(dto.discountType()));
        if (dto.discountValue() != null) existing.setDiscountValue(dto.discountValue());
        if (dto.isActive() != null) existing.setActive(dto.isActive());
        if (dto.startDate() != null) existing.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) existing.setEndDate(LocalDate.parse(dto.endDate()));

        return toLosDto(lengthOfStayDiscountRepository.save(existing));
    }

    @Transactional
    public void deleteLosDiscount(Long id, String keycloakId) {
        LengthOfStayDiscount existing = lengthOfStayDiscountRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Remise LOS non trouvee: " + id));
        requireRuleAccess(existing.getProperty(), existing.getOrganizationId(), keycloakId);

        lengthOfStayDiscountRepository.delete(existing);
    }

    // ── Occupancy Pricing ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Optional<OccupancyPricingDto> getOccupancyPricing(Long propertyId, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return occupancyPricingRepository.findByPropertyId(propertyId, orgId)
                .map(this::toOccupancyDto);
    }

    @Transactional
    public OccupancyPricingDto upsertOccupancyPricing(Long propertyId, OccupancyPricingDto dto, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
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

        return toOccupancyDto(occupancyPricingRepository.save(pricing));
    }

    // ── Yield Rules ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<YieldRuleDto> getYieldRules(Long propertyId, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return yieldRuleRepository.findAllByPropertyId(propertyId, orgId).stream()
                .map(this::toYieldRuleDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public YieldRuleDto createYieldRule(YieldRuleDto dto, String keycloakId) {
        if (dto.propertyId() != null) {
            reservationService.validatePropertyAccess(dto.propertyId(), keycloakId);
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        YieldRule saved = yieldRuleRepository.save(fromYieldRuleDto(dto, orgId));
        return toYieldRuleDto(saved);
    }

    @Transactional
    public YieldRuleDto updateYieldRule(Long id, YieldRuleDto dto, String keycloakId) {
        YieldRule existing = yieldRuleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Regle yield non trouvee: " + id));
        requireRuleAccess(existing.getProperty(), existing.getOrganizationId(), keycloakId);

        if (dto.name() != null) existing.setName(dto.name());
        if (dto.ruleType() != null) existing.setRuleType(YieldRule.RuleType.valueOf(dto.ruleType()));
        if (dto.triggerCondition() != null) existing.setTriggerCondition(dto.triggerCondition());
        if (dto.adjustmentType() != null) existing.setAdjustmentType(YieldRule.AdjustmentType.valueOf(dto.adjustmentType()));
        if (dto.adjustmentValue() != null) existing.setAdjustmentValue(dto.adjustmentValue());
        // Clamps min/max appliques inconditionnellement : null = suppression
        // volontaire du clamp (semantique preservee de l'audit yield).
        existing.setMinPrice(dto.minPrice());
        existing.setMaxPrice(dto.maxPrice());
        if (dto.isActive() != null) existing.setActive(dto.isActive());
        if (dto.priority() != null) existing.setPriority(dto.priority());

        return toYieldRuleDto(yieldRuleRepository.save(existing));
    }

    @Transactional
    public void deleteYieldRule(Long id, String keycloakId) {
        YieldRule existing = yieldRuleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Regle yield non trouvee: " + id));
        requireRuleAccess(existing.getProperty(), existing.getOrganizationId(), keycloakId);

        yieldRuleRepository.delete(existing);
    }

    /**
     * Declenche l'evaluation manuelle des regles de yield.
     * Pas de @Transactional : le scheduler orchestre ses propres ecritures.
     *
     * @return false si le scheduler yield n'est pas actif dans ce deploiement
     */
    public boolean evaluateYieldRules(Long propertyId, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        if (yieldManagementScheduler == null) {
            return false;
        }
        yieldManagementScheduler.evaluateForProperty(propertyId, orgId);
        return true;
    }

    // ── Bulk Update ──────────────────────────────────────────────────────────

    /**
     * Mise a jour tarifaire en masse : ecrit un RateOverride source MANUAL
     * (priorite maximale du PriceEngine) + une entree d'audit par date.
     */
    @Transactional
    public void bulkUpdate(BulkRateUpdateRequest request, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        for (Long propertyId : request.propertyIds()) {
            reservationService.validatePropertyAccess(propertyId, keycloakId);

            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

            for (LocalDate date = request.from(); !date.isAfter(request.to()); date = date.plusDays(1)) {
                BigDecimal currentPrice = priceEngine.resolvePrice(propertyId, date, orgId);
                if (currentPrice == null) continue;

                BigDecimal newPrice = calculateBulkAdjustedPrice(currentPrice, request);
                RateOverride override = new RateOverride(property, date, newPrice, "MANUAL", orgId);
                override.setCreatedBy(keycloakId);
                rateOverrideRepository.save(override);

                rateAuditLogRepository.save(new RateAuditLog(
                        orgId, propertyId, date,
                        currentPrice, newPrice,
                        "MANUAL", keycloakId, null));
            }
        }
    }

    // ── Audit Log ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RateAuditLogDto> getAuditLog(Long propertyId, LocalDate from,
                                             LocalDate to, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return rateAuditLogRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .map(RateAuditLogDto::from)
                .collect(Collectors.toList());
    }

    // ── Ownership ────────────────────────────────────────────────────────────

    /**
     * Validation d'acces d'une regle tarifaire chargee par findById (qui
     * contourne le filtre Hibernate — CLAUDE.md « Lecons », regle 3) :
     * - regle liee a une propriete → regle transverse validatePropertyAccess ;
     * - regle org-wide (sans propriete) → controle d'org direct.
     */
    private void requireRuleAccess(@Nullable Property property, Long entityOrgId, String keycloakId) {
        if (property != null) {
            reservationService.validatePropertyAccess(property.getId(), keycloakId);
            return;
        }
        requireSameOrganization(entityOrgId, keycloakId);
    }

    /**
     * Refuse l'acces si la regle appartient a une autre organisation.
     * Delegue a {@link com.clenzy.service.access.OrganizationAccessGuard}
     * (fail-closed, bypass platform staff + org SYSTEM). Le {@code keycloakId}
     * est conserve dans la signature pour la coherence avec {@link #requireRuleAccess}.
     */
    private void requireSameOrganization(Long entityOrgId, String keycloakId) {
        organizationAccessGuard.requireSameOrganization(
                entityOrgId, "Acces refuse : regle tarifaire hors de votre organisation");
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
            modifier.setProperty(loadProperty(dto.propertyId()));
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
            discount.setProperty(loadProperty(dto.propertyId()));
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
            rule.setProperty(loadProperty(dto.propertyId()));
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

    private Property loadProperty(Long propertyId) {
        return propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));
    }

    private BigDecimal calculateBulkAdjustedPrice(BigDecimal currentPrice, BulkRateUpdateRequest request) {
        return switch (request.priceAdjustmentType()) {
            case "PERCENTAGE" -> {
                BigDecimal adj = currentPrice.multiply(request.priceAdjustmentValue())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                yield currentPrice.add(adj).max(BigDecimal.ZERO);
            }
            case "FIXED" -> currentPrice.add(request.priceAdjustmentValue()).max(BigDecimal.ZERO);
            default -> currentPrice;
        };
    }
}
