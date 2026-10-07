package com.clenzy.controller;

import com.clenzy.service.payout.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(ProviderPayoutBeneficiaryControllerSecurityTest.Config.class)
class ProviderPayoutBeneficiaryControllerSecurityTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean ProviderPayoutBeneficiaryService service() { return mock(ProviderPayoutBeneficiaryService.class); }
        @Bean HousekeeperPayoutService payouts() { return mock(HousekeeperPayoutService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean ProviderPayoutBeneficiaryController controller(ProviderPayoutBeneficiaryService service,TenantContext tenant,HousekeeperPayoutService payouts) {
            return new ProviderPayoutBeneficiaryController(service,tenant,payouts);
        }
    }
    @Autowired ProviderPayoutBeneficiaryController controller;
    @Autowired ProviderPayoutBeneficiaryService service;
    @Autowired HousekeeperPayoutService payouts;
    @Autowired TenantContext tenant;
    @BeforeEach void setup() { reset(service,payouts,tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    private Jwt jwt() { return Jwt.withTokenValue("test").header("alg","none").subject("admin").build(); }
    @Test @WithMockUser(roles="TECHNICIAN") void providerCannotRedirectFunds() { denied(); }
    @Test @WithMockUser(roles="HOST") void hostCannotRedirectFunds() { denied(); }
    private void denied() {
        assertThatThrownBy(() -> controller.choice(11L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.select(11L,new ProviderPayoutBeneficiaryController.OrganizationChoice(9L),jwt()))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service,payouts);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void platformUsesTenantAndActorThenProcessesCommittedChoice() {
        controller.select(11L,new ProviderPayoutBeneficiaryController.OrganizationChoice(9L),jwt());
        var order=inOrder(service,payouts);
        order.verify(service).selectOrganization(11L,7L,9L,"admin");
        order.verify(payouts).processCompletedMission(11L,7L);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void failedSelectionNeverAttemptsTransfer() {
        when(service.selectOrganization(any(),any(),any(),any())).thenThrow(new IllegalStateException("Locked"));
        assertThatThrownBy(() -> controller.select(11L,new ProviderPayoutBeneficiaryController.OrganizationChoice(9L),jwt()))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(payouts);
    }
}
