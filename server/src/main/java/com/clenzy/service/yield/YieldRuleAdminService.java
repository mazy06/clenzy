package com.clenzy.service.yield;

import com.clenzy.dto.yield.YieldAdjustmentDto;
import com.clenzy.dto.yield.YieldConfigDto;
import com.clenzy.dto.yield.YieldJournalPageDto;
import com.clenzy.dto.yield.YieldPropertyBoundsDto;
import com.clenzy.dto.yield.YieldRuleV1Dto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.YieldAdjustment;
import com.clenzy.model.YieldMode;
import com.clenzy.model.YieldOrgConfig;
import com.clenzy.model.YieldRule;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.YieldAdjustmentRepository;
import com.clenzy.repository.YieldOrgConfigRepository;
import com.clenzy.repository.YieldRuleRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Administration du yield v1 (F8a) : config org (kill-switch + mode), CRUD des
 * règles v1, bornes plancher/plafond par bien, lecture du journal.
 *
 * <p>Tout est org-scopé : l'org courante vient du {@link TenantContext} et les
 * chargements par ID (qui contournent le filtre Hibernate) repassent par
 * {@link OrganizationAccessGuard#requireSameOrganization} (CLAUDE.md « Leçons », règle 3).</p>
 */
@Service
public class YieldRuleAdminService {

    private static final int MAX_PAGE_SIZE = 100;
    static final BigDecimal MAX_ADJUSTMENT_PCT = BigDecimal.valueOf(50);
    static final int MAX_WINDOW_DAYS = 365;

    private final YieldOrgConfigRepository configRepository;
    private final YieldRuleRepository yieldRuleRepository;
    private final YieldAdjustmentRepository journalRepository;
    private final PropertyRepository propertyRepository;
    private final TenantContext tenantContext;
    private final OrganizationAccessGuard organizationAccessGuard;

    public YieldRuleAdminService(YieldOrgConfigRepository configRepository,
                                 YieldRuleRepository yieldRuleRepository,
                                 YieldAdjustmentRepository journalRepository,
                                 PropertyRepository propertyRepository,
                                 TenantContext tenantContext,
                                 OrganizationAccessGuard organizationAccessGuard) {
        this.configRepository = configRepository;
        this.yieldRuleRepository = yieldRuleRepository;
        this.journalRepository = journalRepository;
        this.propertyRepository = propertyRepository;
        this.tenantContext = tenantContext;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    // ── Config org (kill-switch + mode) ─────────────────────────────────────

    @Transactional(readOnly = true)
    public YieldConfigDto getConfig() {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        return configRepository.findByOrganizationId(orgId)
                .map(YieldRuleAdminService::toConfigDto)
                .orElseGet(() -> toConfigDto(new YieldOrgConfig(orgId)));
    }

    @Transactional
    public YieldConfigDto updateConfig(YieldConfigDto request) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final YieldMode mode = parseMode(request.mode());
        final YieldOrgConfig config = configRepository.findByOrganizationId(orgId)
                .orElseGet(() -> new YieldOrgConfig(orgId));
        config.setEnabled(request.enabled());
        config.setMode(mode);
        // Automatisations R2 : null = inchangé (un client qui n'envoie pas ces
        // champs ne doit rien modifier) ; sinon bornes serrées — une valeur
        // aberrante est refusée plutôt que clampée silencieusement.
        if (request.orphanGapEnabled() != null) {
            config.setOrphanGapEnabled(request.orphanGapEnabled());
        }
        if (request.orphanGapMaxNights() != null) {
            config.setOrphanGapMaxNights(requireRange(request.orphanGapMaxNights(), 1, 7, "orphanGapMaxNights"));
        }
        if (request.orphanGapDiscountPct() != null) {
            final java.math.BigDecimal pct = request.orphanGapDiscountPct();
            if (pct.compareTo(java.math.BigDecimal.ZERO) < 0
                    || pct.compareTo(java.math.BigDecimal.valueOf(50)) > 0) {
                throw new IllegalArgumentException("orphanGapDiscountPct doit être entre 0 et 50");
            }
            config.setOrphanGapDiscountPct(pct);
        }
        if (request.minStayAutoEnabled() != null) {
            config.setMinStayAutoEnabled(request.minStayAutoEnabled());
        }
        if (request.minStayReduceWithinDays() != null) {
            config.setMinStayReduceWithinDays(requireRange(request.minStayReduceWithinDays(), 1, 60, "minStayReduceWithinDays"));
        }
        if (request.minStayReducedValue() != null) {
            config.setMinStayReducedValue(requireRange(request.minStayReducedValue(), 1, 30, "minStayReducedValue"));
        }
        final YieldOrgConfig saved = configRepository.save(config);
        return toConfigDto(saved);
    }

    private static YieldConfigDto toConfigDto(YieldOrgConfig c) {
        return new YieldConfigDto(c.isEnabled(), c.getMode().name(),
                c.isOrphanGapEnabled(), c.getOrphanGapMaxNights(), c.getOrphanGapDiscountPct(),
                c.isMinStayAutoEnabled(), c.getMinStayReduceWithinDays(), c.getMinStayReducedValue());
    }

    private static int requireRange(int value, int min, int max, String field) {
        if (value < min || value > max) {
            throw new IllegalArgumentException(field + " doit être entre " + min + " et " + max);
        }
        return value;
    }

    // ── Règles v1 ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<YieldRuleV1Dto> listRules() {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        return yieldRuleRepository.findAllV1ByOrganization(orgId).stream()
                .map(YieldRuleAdminService::toDto)
                .toList();
    }

    @Transactional
    public YieldRuleV1Dto createRule(YieldRuleV1Dto dto) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        validateRule(dto);

        final YieldRule rule = new YieldRule();
        rule.setOrganizationId(orgId);
        rule.setRuleType(YieldRule.RuleType.OCCUPANCY_THRESHOLD);
        rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
        if (dto.propertyId() != null) {
            rule.setProperty(loadOwnedProperty(dto.propertyId()));
        }
        applyRuleFields(rule, dto);
        return toDto(yieldRuleRepository.save(rule));
    }

    @Transactional
    public YieldRuleV1Dto updateRule(Long id, YieldRuleV1Dto dto) {
        final YieldRule rule = loadOwnedV1Rule(id);
        validateRule(dto);
        if (dto.propertyId() != null) {
            rule.setProperty(loadOwnedProperty(dto.propertyId()));
        } else {
            rule.setProperty(null);
        }
        applyRuleFields(rule, dto);
        return toDto(yieldRuleRepository.save(rule));
    }

    @Transactional
    public void deleteRule(Long id) {
        yieldRuleRepository.delete(loadOwnedV1Rule(id));
    }

    // ── Bornes par bien ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<YieldPropertyBoundsDto> listPropertyBounds() {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        return propertyRepository.findByOrganizationId(orgId).stream()
                .map(p -> new YieldPropertyBoundsDto(
                        p.getId(), p.getName(), p.getYieldPriceFloor(), p.getYieldPriceCeiling()))
                .toList();
    }

    @Transactional
    public YieldPropertyBoundsDto updatePropertyBounds(Long propertyId,
                                                       BigDecimal floor, BigDecimal ceiling) {
        if ((floor == null) != (ceiling == null)) {
            throw new IllegalArgumentException(
                    "Plancher et plafond vont ensemble : renseignez les deux, ou aucun");
        }
        if (floor != null) {
            if (floor.signum() <= 0 || ceiling.signum() <= 0) {
                throw new IllegalArgumentException("Les bornes yield doivent être strictement positives");
            }
            if (floor.compareTo(ceiling) >= 0) {
                throw new IllegalArgumentException("Le plancher doit être strictement inférieur au plafond");
            }
        }
        final Property property = loadOwnedProperty(propertyId);
        property.setYieldPriceFloor(floor);
        property.setYieldPriceCeiling(ceiling);
        final Property saved = propertyRepository.save(property);
        return new YieldPropertyBoundsDto(saved.getId(), saved.getName(),
                saved.getYieldPriceFloor(), saved.getYieldPriceCeiling());
    }

    // ── Journal ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public YieldJournalPageDto getJournal(Long propertyId, int page, int size) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final Pageable pageable = PageRequest.of(Math.max(0, page),
                Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        final Page<YieldAdjustment> result = propertyId != null
                ? journalRepository.findByOrganizationIdAndPropertyIdOrderByCreatedAtDescIdDesc(
                        orgId, propertyId, pageable)
                : journalRepository.findByOrganizationIdOrderByCreatedAtDescIdDesc(orgId, pageable);
        return new YieldJournalPageDto(
                result.getContent().stream().map(YieldAdjustmentDto::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private YieldRule loadOwnedV1Rule(Long id) {
        final YieldRule rule = yieldRuleRepository.findById(id)
                .filter(r -> r.getComparison() != null)
                .orElseThrow(() -> new NotFoundException("Règle yield introuvable : " + id));
        organizationAccessGuard.requireSameOrganization(rule.getOrganizationId(),
                "Accès refusé : règle yield hors de votre organisation");
        return rule;
    }

    private Property loadOwnedProperty(Long propertyId) {
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
        organizationAccessGuard.requireSameOrganization(property.getOrganizationId(),
                "Accès refusé : logement hors de votre organisation");
        return property;
    }

    private void applyRuleFields(YieldRule rule, YieldRuleV1Dto dto) {
        final YieldRule.Comparison comparison = parseComparison(dto.comparison());
        rule.setName(dto.name().strip());
        rule.setComparison(comparison);
        rule.setOccupancyThresholdPct(dto.occupancyThresholdPct());
        rule.setWindowDaysAhead(dto.windowDaysAhead());
        rule.setAdjustmentPct(dto.adjustmentPct().abs());
        rule.setMaxDailyChangePct(dto.maxDailyChangePct() != null
                ? dto.maxDailyChangePct().abs() : BigDecimal.TEN);
        rule.setActive(dto.active() == null || dto.active());
        rule.setPriority(dto.priority() != null ? dto.priority() : 0);
        // Miroir JSONB legacy (colonne NOT NULL, lisible par l'ancien affichage calendrier)
        final String conditionKey = comparison == YieldRule.Comparison.BELOW
                ? "occupancyBelow" : "occupancyAbove";
        rule.setTriggerCondition(String.format("{\"%s\":%s,\"daysAhead\":%d}",
                conditionKey, dto.occupancyThresholdPct().toPlainString(), dto.windowDaysAhead()));
    }

    private void validateRule(YieldRuleV1Dto dto) {
        if (dto.name() == null || dto.name().isBlank()) {
            throw new IllegalArgumentException("Le nom de la règle est requis");
        }
        parseComparison(dto.comparison());
        if (dto.occupancyThresholdPct() == null
                || dto.occupancyThresholdPct().signum() < 0
                || dto.occupancyThresholdPct().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("Seuil d'occupation invalide (0-100 %)");
        }
        if (dto.windowDaysAhead() == null || dto.windowDaysAhead() < 1
                || dto.windowDaysAhead() > MAX_WINDOW_DAYS) {
            throw new IllegalArgumentException("Fenêtre invalide (1-" + MAX_WINDOW_DAYS + " jours)");
        }
        if (dto.adjustmentPct() == null || dto.adjustmentPct().signum() == 0
                || dto.adjustmentPct().abs().compareTo(MAX_ADJUSTMENT_PCT) > 0) {
            throw new IllegalArgumentException(
                    "Ajustement invalide (ampleur 0-" + MAX_ADJUSTMENT_PCT + " %)");
        }
        if (dto.maxDailyChangePct() != null
                && (dto.maxDailyChangePct().signum() <= 0
                        || dto.maxDailyChangePct().compareTo(MAX_ADJUSTMENT_PCT) > 0)) {
            throw new IllegalArgumentException(
                    "Cap journalier invalide (1-" + MAX_ADJUSTMENT_PCT + " %)");
        }
    }

    private static YieldMode parseMode(String mode) {
        try {
            return YieldMode.valueOf(mode);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("Mode yield invalide : " + mode);
        }
    }

    private static YieldRule.Comparison parseComparison(String comparison) {
        try {
            return YieldRule.Comparison.valueOf(comparison);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("Comparaison invalide (BELOW/ABOVE) : " + comparison);
        }
    }

    private static YieldRuleV1Dto toDto(YieldRule rule) {
        return new YieldRuleV1Dto(
                rule.getId(),
                rule.getProperty() != null ? rule.getProperty().getId() : null,
                rule.getName(),
                rule.getComparison() != null ? rule.getComparison().name() : null,
                rule.getOccupancyThresholdPct(),
                rule.getWindowDaysAhead(),
                rule.getAdjustmentPct(),
                rule.getMaxDailyChangePct(),
                rule.isActive(),
                rule.getPriority());
    }
}
