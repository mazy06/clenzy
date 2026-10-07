package com.clenzy.controller;

import com.clenzy.model.PayoutBeneficiary;
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

@SpringJUnitConfig(BaitlyExpensePayoutControllerSecurityTest.Config.class)
class BaitlyExpensePayoutControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyExpensePayoutService payouts() { return mock(BaitlyExpensePayoutService.class); }
        @Bean BaitlyExpenseBeneficiaryService choices() { return mock(BaitlyExpenseBeneficiaryService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean BaitlyExpensePayoutController controller(BaitlyExpensePayoutService payouts,TenantContext tenant,BaitlyExpenseBeneficiaryService choices) {
            return new BaitlyExpensePayoutController(payouts,tenant,choices);
        }
    }
    @Autowired BaitlyExpensePayoutController controller;
    @Autowired BaitlyExpensePayoutService payouts;
    @Autowired BaitlyExpenseBeneficiaryService choices;
    @Autowired TenantContext tenant;
    @BeforeEach void setup() { reset(payouts,choices,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    Jwt jwt() { return Jwt.withTokenValue("test").header("alg","none").subject("admin").build(); }
    void denied() {
        assertThatThrownBy(()->controller.preview(31L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.transfer(31L,PayoutBeneficiary.organization(9L))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.selectCompany(31L,new BaitlyExpensePayoutController.Company(9L),jwt())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payouts,choices);
    }
    @Test @WithMockUser(roles="HOST") void hostCannotRedirectOrSendFunds() { denied(); }
    @Test @WithMockUser(roles="HOUSEKEEPER") void providerCannotRedirectOrSendFunds() { denied(); }
    @Test void anonymousCannotReadRecipients() { assertThatThrownBy(()->controller.preview(31L)).isInstanceOf(org.springframework.security.core.AuthenticationException.class); }
    @Test @WithMockUser(roles="SUPER_MANAGER") void choiceUsesTenantAndActorWithoutSendingMoney() {
        controller.selectCompany(31L,new BaitlyExpensePayoutController.Company(9L),jwt());
        verify(choices).selectCompany(31L,7L,9L,"admin");verifyNoInteractions(payouts);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void transferCarriesExactlyTheConfirmedBeneficiary() throws Exception {
        controller.transfer(31L,PayoutBeneficiary.organization(9L));
        verify(payouts).pay(31L,7L,PayoutBeneficiary.organization(9L));
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void httpRequiresOnePositiveRecipientAndNeverTrustsATenantFromTheBody() throws Exception {
        var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
        for(String invalid:new String[]{"", "{}", "{\"userId\":42,\"organizationId\":9}", "{\"organizationId\":-1}"}) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/provider-expenses/31/transfer")
                    .contentType("application/json").content(invalid))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
        }
        verifyNoInteractions(payouts);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/provider-expenses/31/transfer")
                .contentType("application/json").content("{\"userId\":42,\"organizationId\":null,\"tenantId\":999,\"amount\":1}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        verify(payouts).pay(31L,7L,PayoutBeneficiary.user(42L));
    }
}
