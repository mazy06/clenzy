package com.clenzy.controller;

import com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments;
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

@SpringJUnitConfig(BaitlyInvoiceFiscalSecurityTest.Config.class)
class BaitlyInvoiceFiscalSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyInvoiceFiscalDocuments documents(){return mock(BaitlyInvoiceFiscalDocuments.class);}
        @Bean OrganizationService access(){return mock(OrganizationService.class);}
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean BaitlyInvoiceFiscalController controller(BaitlyInvoiceFiscalDocuments documents,OrganizationService access,TenantContext tenant){return new BaitlyInvoiceFiscalController(documents,access,tenant);}
    }
    @Autowired BaitlyInvoiceFiscalController controller;@Autowired BaitlyInvoiceFiscalDocuments documents;
    @Autowired OrganizationService access;@Autowired TenantContext tenant;
    @BeforeEach void setup(){reset(documents,access,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(2L);}
    Jwt jwt(){return Jwt.withTokenValue("test").header("alg","none").subject("host").build();}
    @Test void anonymousCannotReadPrepareOrDownload(){
        assertThatThrownBy(()->controller.view(jwt(),1L)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(()->controller.archive(jwt(),1L,null)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(()->controller.download(jwt(),1L)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);verifyNoInteractions(documents);
    }
    @Test @WithMockUser(roles="HOST") void managementIsRequiredOnEveryEndpoint(){
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("host",2L);
        assertThatThrownBy(()->controller.view(jwt(),1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.check(jwt(),1L,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.archive(jwt(),1L,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.download(jwt(),1L)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(documents);
    }
    @Test @WithMockUser(roles="HOST") void organizationAndActorComeFromTheAuthenticatedContext(){
        var request=new BaitlyInvoiceFiscalDocuments.Request("a".repeat(64),null);controller.archive(jwt(),3L,request);
        var order=inOrder(access,documents);order.verify(access).validateOrgManagement("host",2L);order.verify(documents).archive(2L,3L,request,"host");
    }
}
