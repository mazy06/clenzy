package com.clenzy.controller;

import com.clenzy.service.BaitlyInvoiceVerification;
import com.clenzy.service.OrganizationService;
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

@SpringJUnitConfig(BaitlyDocumentVerificationSecurityTest.Config.class)
class BaitlyDocumentVerificationSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyInvoiceVerification documents(){return mock(BaitlyInvoiceVerification.class);}
        @Bean OrganizationService access(){return mock(OrganizationService.class);}
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean BaitlyDocumentVerificationController controller(BaitlyInvoiceVerification documents,OrganizationService access,TenantContext tenant){return new BaitlyDocumentVerificationController(documents,access,tenant);}
    }
    @Autowired BaitlyDocumentVerificationController controller;@Autowired BaitlyInvoiceVerification documents;
    @Autowired OrganizationService access;@Autowired TenantContext tenant;
    @BeforeEach void setup(){reset(documents,access,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(2L);}
    Jwt jwt(){return Jwt.withTokenValue("test").header("alg","none").subject("host").build();}
    @Test void anonymousCannotReadOrWrite(){
        assertThatThrownBy(()->controller.list(jwt())).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(()->controller.check(jwt(),1L)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(()->controller.draft(jwt(),1L,null)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);verifyNoInteractions(documents);
    }
    @Test @WithMockUser(roles="HOST") void everyEndpointRequiresOrganizationManagement(){
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("host",2L);
        assertThatThrownBy(()->controller.list(jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.view(jwt(),1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.check(jwt(),1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.draft(jwt(),1L,null)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(documents);
    }
    @Test @WithMockUser(roles="HOST") void organizationAndReviewerComeFromTheAuthenticatedContext(){
        controller.check(jwt(),3L);
        var order=inOrder(access,documents);order.verify(access).validateOrgManagement("host",2L);order.verify(documents).check(2L,3L,"host");
    }
}
