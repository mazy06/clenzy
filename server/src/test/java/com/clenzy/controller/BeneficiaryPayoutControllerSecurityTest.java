package com.clenzy.controller;

import com.clenzy.service.payout.BeneficiaryPayoutService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.Scope.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BeneficiaryPayoutControllerSecurityTest.Config.class)
class BeneficiaryPayoutControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BeneficiaryPayoutService service() { return mock(BeneficiaryPayoutService.class); }
        @Bean BeneficiaryPayoutController controller(BeneficiaryPayoutService service) { return new BeneficiaryPayoutController(service); }
    }
    @Autowired BeneficiaryPayoutController controller;
    @Autowired BeneficiaryPayoutService service;
    @BeforeEach void setup() { reset(service); }
    @Test void anonymousCannotReadAnyTransfer() {
        assertThatThrownBy(() -> controller.list(null,PERSONAL,0)).isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(() -> controller.detail(null,1L,PERSONAL)).isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="TECHNICIAN") void recipientIdentityComesOnlyFromJwt() {
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("authenticated-provider").build();
        controller.list(jwt,PERSONAL,0); controller.detail(jwt,12L,ORGANIZATION);
        verify(service).list("authenticated-provider",PERSONAL,0);
        verify(service).detail("authenticated-provider",ORGANIZATION,12L);
    }
}
