package com.clenzy.controller;

import com.clenzy.service.*;
import com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore;
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

@SpringJUnitConfig(BaitlyCommerceDocumentSecurityTest.Config.class)
class BaitlyCommerceDocumentSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean OrganizationService access(){return mock(OrganizationService.class);}
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean BaitlySaleDocumentStore sales(){return mock(BaitlySaleDocumentStore.class);}
        @Bean BaitlyCommerceEvidenceStore evidence(){return mock(BaitlyCommerceEvidenceStore.class);}
        @Bean BaitlyEInvoiceStore submissions(){return mock(BaitlyEInvoiceStore.class);}
        @Bean BaitlySaleDocumentController salesController(BaitlySaleDocumentStore s,TenantContext t,OrganizationService a){return new BaitlySaleDocumentController(s,t,a);}
        @Bean BaitlyCommerceEvidenceController evidenceController(BaitlyCommerceEvidenceStore s,TenantContext t,OrganizationService a){return new BaitlyCommerceEvidenceController(s,a,t);}
        @Bean BaitlyFiscalSubmissionController submissionController(BaitlyEInvoiceStore s,TenantContext t,OrganizationService a){return new BaitlyFiscalSubmissionController(s,a,t);}
    }
    @Autowired OrganizationService access;@Autowired TenantContext tenant;@Autowired BaitlySaleDocumentStore sales;@Autowired BaitlyCommerceEvidenceStore evidence;@Autowired BaitlyEInvoiceStore submissions;
    @Autowired BaitlySaleDocumentController documents;@Autowired BaitlyCommerceEvidenceController proofs;@Autowired BaitlyFiscalSubmissionController fiscal;
    Jwt jwt(){return Jwt.withTokenValue("test").header("alg","none").subject("host").build();}
    @BeforeEach void prepare(){reset(access,tenant,sales,evidence,submissions);when(tenant.getRequiredOrganizationId()).thenReturn(7L);}
    @Test void anonymousCannotReadOrExportDocuments(){assertThatThrownBy(()->documents.export(1L,jwt())).isInstanceOf(org.springframework.security.core.AuthenticationException.class);verifyNoInteractions(sales);}
    @Test @WithMockUser(roles="HOST") void ordinaryMemberCannotReadFiscalOrCommercialFiles(){
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("host",7L);
        assertThatThrownBy(()->documents.list("SUBSCRIPTION",1L,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->documents.export(1L,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->proofs.download(1L,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->proofs.attach("UPSELL",1L,null,null,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->fiscal.list(jwt())).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(sales,evidence,submissions);
    }
    @Test @WithMockUser(roles="HOST") void verifiedManagerUsesTheActiveTenantForEveryDocument(){
        documents.export(1L,jwt());proofs.list("UPSELL",2L,jwt());fiscal.list(jwt());
        verify(sales).export(7L,1L,null,null);verify(evidence).dossier(7L,"UPSELL",2L);verify(submissions).list(7L);
    }
}
