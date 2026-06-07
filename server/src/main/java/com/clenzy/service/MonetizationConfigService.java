package com.clenzy.service;

import com.clenzy.config.ActivityCommissionConfig;
import com.clenzy.config.UpsellConfig;
import com.clenzy.dto.MonetizationConfigDto;
import com.clenzy.model.OrgMonetizationConfig;
import com.clenzy.repository.OrgMonetizationConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Taux de monétisation effectifs par org, sur deux niveaux :
 * <ul>
 *   <li><b>Commission plateforme</b> (fee upsell / commission activités) — défaut global
 *       {@link UpsellConfig} / {@link ActivityCommissionConfig}, réglée par le staff.</li>
 *   <li><b>Commission org/conciergerie</b> sur le reste après plateforme — défaut 0, réglée par l'org.</li>
 * </ul>
 * Consommé par {@code UpsellService} et {@code ActivityCommissionService}.
 */
@Service
public class MonetizationConfigService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal DEFAULT_UPSELL_FEE = new BigDecimal("10");
    private static final BigDecimal DEFAULT_ACTIVITY_PLATFORM = new BigDecimal("30");

    private final OrgMonetizationConfigRepository repository;
    private final UpsellConfig upsellConfig;
    private final ActivityCommissionConfig commissionConfig;

    public MonetizationConfigService(OrgMonetizationConfigRepository repository,
                                     UpsellConfig upsellConfig,
                                     ActivityCommissionConfig commissionConfig) {
        this.repository = repository;
        this.upsellConfig = upsellConfig;
        this.commissionConfig = commissionConfig;
    }

    // ─── Niveau plateforme ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BigDecimal getEffectiveUpsellPlatformFeePct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getUpsellPlatformFeePct)
            .filter(v -> v != null)
            .orElseGet(this::defaultUpsellFee);
    }

    @Transactional(readOnly = true)
    public BigDecimal getEffectiveActivityPlatformCommissionPct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getActivityPlatformCommissionPct)
            .filter(v -> v != null)
            .orElseGet(this::defaultActivityPlatformCommission);
    }

    // ─── Niveau org / conciergerie (sur le reste après plateforme) ─────────────

    @Transactional(readOnly = true)
    public BigDecimal getEffectiveUpsellOrgCommissionPct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getUpsellOrgCommissionPct)
            .filter(v -> v != null)
            .orElse(BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public BigDecimal getEffectiveActivityOrgCommissionPct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getActivityOrgCommissionPct)
            .filter(v -> v != null)
            .orElse(BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public MonetizationConfigDto getSettings(Long orgId) {
        return new MonetizationConfigDto(
            getEffectiveUpsellPlatformFeePct(orgId),
            getEffectiveActivityPlatformCommissionPct(orgId),
            getEffectiveUpsellOrgCommissionPct(orgId),
            getEffectiveActivityOrgCommissionPct(orgId));
    }

    /** Met à jour la commission PLATEFORME (staff-only). */
    @Transactional
    public MonetizationConfigDto updatePlatform(Long orgId, BigDecimal upsellFeePct, BigDecimal activityCommissionPct) {
        OrgMonetizationConfig config = getOrCreate(orgId);
        config.setUpsellPlatformFeePct(clamp(upsellFeePct));
        config.setActivityPlatformCommissionPct(clamp(activityCommissionPct));
        repository.save(config);
        return getSettings(orgId);
    }

    /** Met à jour la commission ORG/conciergerie (org-editable). */
    @Transactional
    public MonetizationConfigDto updateOrg(Long orgId, BigDecimal upsellOrgPct, BigDecimal activityOrgPct) {
        OrgMonetizationConfig config = getOrCreate(orgId);
        config.setUpsellOrgCommissionPct(clamp(upsellOrgPct));
        config.setActivityOrgCommissionPct(clamp(activityOrgPct));
        repository.save(config);
        return getSettings(orgId);
    }

    private OrgMonetizationConfig getOrCreate(Long orgId) {
        return repository.findByOrganizationId(orgId).orElseGet(() -> {
            OrgMonetizationConfig created = new OrgMonetizationConfig();
            created.setOrganizationId(orgId);
            return created;
        });
    }

    private BigDecimal defaultUpsellFee() {
        return upsellConfig.getPlatformFeePct() != null ? upsellConfig.getPlatformFeePct() : DEFAULT_UPSELL_FEE;
    }

    private BigDecimal defaultActivityPlatformCommission() {
        // Défaut global : complément de la part hôte (70% hôte → 30% plateforme).
        BigDecimal hostShare = commissionConfig.getHostSharePct();
        return hostShare != null ? HUNDRED.subtract(hostShare) : DEFAULT_ACTIVITY_PLATFORM;
    }

    /** Borne 0..100 ; null reste null (= défaut). */
    private static BigDecimal clamp(BigDecimal v) {
        if (v == null) return null;
        if (v.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        if (v.compareTo(HUNDRED) > 0) return HUNDRED;
        return v;
    }
}
