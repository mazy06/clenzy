package com.clenzy.controller;

import com.clenzy.service.payout.PayoutReconciliationService;
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

@SpringJUnitConfig(PayoutReconciliationControllerSecurityTest.Config.class)
class PayoutReconciliationControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean PayoutReconciliationService service() { return mock(PayoutReconciliationService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean PayoutReconciliationController controller(PayoutReconciliationService service,TenantContext tenant) { return new PayoutReconciliationController(service,tenant); }
    }
    @Autowired PayoutReconciliationController controller;
    @Autowired PayoutReconciliationService service;
    @Autowired TenantContext tenant;
    final PayoutReconciliationController.Request request=new PayoutReconciliationController.Request("tr_match");
    @BeforeEach void setup() { reset(service,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    @Test @WithMockUser(roles="HOST") void hostCannotConfirmOrVerify() {
        assertThatThrownBy(() -> controller.verify(1L,request)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.confirm(1L,request,null)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="TECHNICIAN") void technicianCannotConfirm() {
        assertThatThrownBy(() -> controller.confirm(1L,request,null)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void staffUsesSelectedOrganizationAndAuthenticatedActor() {
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("staff-subject").build();
        controller.confirm(1L,request,jwt);verify(service).confirm(7L,1L,"tr_match","staff-subject");
    }
}
