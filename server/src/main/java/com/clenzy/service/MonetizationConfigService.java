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
 * Taux de monétisation effectifs par org : override en base ({@link OrgMonetizationConfig})
 * ou défaut global ({@link UpsellConfig} / {@link ActivityCommissionConfig}).
 * Consommé par {@code UpsellService} (fee plateforme) et {@code ActivityCommissionService}
 * (part hôte), édité dans Paramètres › Paiement.
 */
@Service
public class MonetizationConfigService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal DEFAULT_UPSELL_FEE = new BigDecimal("10");
    private static final BigDecimal DEFAULT_HOST_SHARE = new BigDecimal("70");

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

    /** Part plateforme (%) sur les upsells pour cette org (override ou défaut global). */
    @Transactional(readOnly = true)
    public BigDecimal getEffectiveUpsellFeePct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getUpsellPlatformFeePct)
            .filter(v -> v != null)
            .orElseGet(this::defaultUpsellFee);
    }

    /** Part hôte (%) sur les commissions d'activités pour cette org (override ou défaut global). */
    @Transactional(readOnly = true)
    public BigDecimal getEffectiveActivityHostSharePct(Long orgId) {
        return repository.findByOrganizationId(orgId)
            .map(OrgMonetizationConfig::getActivityHostSharePct)
            .filter(v -> v != null)
            .orElseGet(this::defaultHostShare);
    }

    @Transactional(readOnly = true)
    public MonetizationConfigDto getSettings(Long orgId) {
        return new MonetizationConfigDto(getEffectiveUpsellFeePct(orgId), getEffectiveActivityHostSharePct(orgId));
    }

    @Transactional
    public MonetizationConfigDto updateSettings(Long orgId, BigDecimal upsellFeePct, BigDecimal activityHostSharePct) {
        OrgMonetizationConfig config = repository.findByOrganizationId(orgId)
            .orElseGet(() -> {
                OrgMonetizationConfig created = new OrgMonetizationConfig();
                created.setOrganizationId(orgId);
                return created;
            });
        config.setUpsellPlatformFeePct(clamp(upsellFeePct));
        config.setActivityHostSharePct(clamp(activityHostSharePct));
        repository.save(config);
        return getSettings(orgId);
    }

    private BigDecimal defaultUpsellFee() {
        return upsellConfig.getPlatformFeePct() != null ? upsellConfig.getPlatformFeePct() : DEFAULT_UPSELL_FEE;
    }

    private BigDecimal defaultHostShare() {
        return commissionConfig.getHostSharePct() != null ? commissionConfig.getHostSharePct() : DEFAULT_HOST_SHARE;
    }

    /** Borne 0..100 ; null reste null (= défaut global). */
    private static BigDecimal clamp(BigDecimal v) {
        if (v == null) return null;
        if (v.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        if (v.compareTo(HUNDRED) > 0) return HUNDRED;
        return v;
    }
}
