package com.clenzy.service;

import com.clenzy.config.ActivityCommissionConfig;
import com.clenzy.config.UpsellConfig;
import com.clenzy.model.OrgMonetizationConfig;
import com.clenzy.repository.OrgMonetizationConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MonetizationConfigServiceTest {

    @Mock private OrgMonetizationConfigRepository repository;

    private MonetizationConfigService service() {
        return new MonetizationConfigService(repository, new UpsellConfig(), new ActivityCommissionConfig());
    }

    @Test
    void effectiveValues_fallBackToGlobalDefaults_whenNoOverride() {
        when(repository.findByOrganizationId(1L)).thenReturn(Optional.empty());

        MonetizationConfigService s = service();
        assertThat(s.getEffectiveUpsellPlatformFeePct(1L)).isEqualByComparingTo("10"); // UpsellConfig défaut
        assertThat(s.getEffectiveActivityPlatformCommissionPct(1L)).isEqualByComparingTo("30"); // 100 - 70 (défaut hôte)
        assertThat(s.getEffectiveUpsellOrgCommissionPct(1L)).isEqualByComparingTo("0"); // défaut org
        assertThat(s.getEffectiveActivityOrgCommissionPct(1L)).isEqualByComparingTo("0");
    }

    @Test
    void effectiveValues_useOrgOverride_whenSet() {
        OrgMonetizationConfig cfg = new OrgMonetizationConfig();
        cfg.setOrganizationId(1L);
        cfg.setUpsellPlatformFeePct(new BigDecimal("15"));
        cfg.setActivityPlatformCommissionPct(new BigDecimal("25"));
        cfg.setUpsellOrgCommissionPct(new BigDecimal("20"));
        cfg.setActivityOrgCommissionPct(new BigDecimal("10"));
        when(repository.findByOrganizationId(1L)).thenReturn(Optional.of(cfg));

        MonetizationConfigService s = service();
        assertThat(s.getEffectiveUpsellPlatformFeePct(1L)).isEqualByComparingTo("15");
        assertThat(s.getEffectiveActivityPlatformCommissionPct(1L)).isEqualByComparingTo("25");
        assertThat(s.getEffectiveUpsellOrgCommissionPct(1L)).isEqualByComparingTo("20");
        assertThat(s.getEffectiveActivityOrgCommissionPct(1L)).isEqualByComparingTo("10");
    }
}
