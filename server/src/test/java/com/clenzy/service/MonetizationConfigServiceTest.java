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

        assertThat(service().getEffectiveUpsellFeePct(1L)).isEqualByComparingTo("10"); // UpsellConfig défaut
        assertThat(service().getEffectiveActivityHostSharePct(1L)).isEqualByComparingTo("70"); // ActivityCommissionConfig défaut
    }

    @Test
    void effectiveValues_useOrgOverride_whenSet() {
        OrgMonetizationConfig cfg = new OrgMonetizationConfig();
        cfg.setOrganizationId(1L);
        cfg.setUpsellPlatformFeePct(new BigDecimal("15"));
        cfg.setActivityHostSharePct(new BigDecimal("80"));
        when(repository.findByOrganizationId(1L)).thenReturn(Optional.of(cfg));

        assertThat(service().getEffectiveUpsellFeePct(1L)).isEqualByComparingTo("15");
        assertThat(service().getEffectiveActivityHostSharePct(1L)).isEqualByComparingTo("80");
    }
}
