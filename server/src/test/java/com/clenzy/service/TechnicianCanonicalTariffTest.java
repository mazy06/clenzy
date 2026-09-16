package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto.ServicePriceConfig;
import com.clenzy.model.ProviderTariff;
import com.clenzy.model.User;
import com.clenzy.repository.ProviderTariffRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.pricing.ProviderTariffService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TechnicianCanonicalTariffTest {
    final ProviderTariffRepository prices = mock(ProviderTariffRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final TenantContext tenant = mock(TenantContext.class);
    final TechnicianPrestationService service = new TechnicianPrestationService(prices,users,tenant,
            mock(PricingConfigService.class),new ProviderTariffService(prices));
    void authenticated() {
        var user=new User();user.setId(7L);
        when(users.findByKeycloakId("subject")).thenReturn(Optional.of(user));
    }
    @Test void unknownSubjectCannotWriteAPrice() {
        assertThatThrownBy(()->service.updateMine("unknown",List.of()))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(prices);
    }
    @Test void sameIdentityReadsSamePriceAndReviewStatusInBothOrganizations() {
        authenticated();var tariff=new ProviderTariff();tariff.setServiceKey("maintenance-plumbing");
        tariff.setNeedsReview(true);tariff.setCurrency("MAD");
        when(prices.findByUserIdOrderByServiceKeyAsc(7L)).thenReturn(List.of(tariff));
        when(tenant.getRequiredOrganizationId()).thenReturn(101L,202L);
        for(int i=0;i<2;i++) {
            var dto=service.getMine("subject").get(0);
            assertThat(dto.getInterventionType()).isEqualTo("PLUMBING_REPAIR");
            assertThat(dto.getBasePrice()).isNull();assertThat(dto.isNeedsReview()).isTrue();
            assertThat(dto.getCurrency()).isEqualTo("MAD");
        }
    }
    @Test void anotherOrganizationsPrivateProviderCannotBeEnumeratedById() {
        when(tenant.getRequiredOrganizationId()).thenReturn(101L);
        assertThatThrownBy(()->service.getForUser(9L)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(prices,never()).findByUserIdOrderByServiceKeyAsc(any());
    }
    @Test void nonFinitePriceIsRejectedBeforeChangingExistingPrices() {
        authenticated();
        assertThatThrownBy(()->service.updateMine("subject",List.of(new ServicePriceConfig("PLUMBING_REPAIR",Double.NaN,true))))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(prices);
    }
}
