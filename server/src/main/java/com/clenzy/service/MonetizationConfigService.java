package com.clenzy.service;

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
 *       {@link UpsellConfig}, réglée par le staff.</li>
 *   <li><b>Commission org/conciergerie</b> sur le reste après plateforme — défaut 0, réglée par l'org.</li>
 * </ul>
 * Consommé par {@code UpsellService}.
 */
@Service
public class MonetizationConfigService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal DEFAULT_UPSELL_FEE = new BigDecimal("10");

    private final OrgMonetizationConfigRepository repository;
    private final UpsellConfig upsellConfig;

    public MonetizationConfigService(OrgMonetizationConfigRepository repository,
                                     UpsellConfig upsellConfig) {
        this.repository = repository;
        this.upsellConfig = upsellConfig;
    }

    // ─── Niveau plateforme ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BigDecimal getEffectiveUpsellPlatformFeePct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getUpsellPlatformFeePct)
            .filter(v -> v != null)
            .orElseGet(this::defaultUpsellFee);
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
    public MonetizationConfigDto getSettings(Long orgId) {
        return new MonetizationConfigDto(
            getEffectiveUpsellPlatformFeePct(orgId),
            getEffectiveUpsellOrgCommissionPct(orgId));
    }

    /** Met à jour la commission PLATEFORME (staff-only). */
    @Transactional
    public MonetizationConfigDto updatePlatform(Long orgId, BigDecimal upsellFeePct) {
        OrgMonetizationConfig config = getOrCreate(orgId);
        config.setUpsellPlatformFeePct(clamp(upsellFeePct));
        repository.save(config);
        return getSettings(orgId);
    }

    /** Met à jour la commission ORG/conciergerie (org-editable). */
    @Transactional
    public MonetizationConfigDto updateOrg(Long orgId, BigDecimal upsellOrgPct) {
        OrgMonetizationConfig config = getOrCreate(orgId);
        config.setUpsellOrgCommissionPct(clamp(upsellOrgPct));
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


    /** Borne 0..100 ; null reste null (= défaut). */
    private static BigDecimal clamp(BigDecimal v) {
        if (v == null) return null;
        if (v.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        if (v.compareTo(HUNDRED) > 0) return HUNDRED;
        return v;
    }
}
