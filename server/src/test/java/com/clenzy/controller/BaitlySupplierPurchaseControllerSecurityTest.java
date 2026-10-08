package com.clenzy.controller;

import com.clenzy.service.BaitlySupplierPurchaseService;
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

@SpringJUnitConfig(BaitlySupplierPurchaseControllerSecurityTest.Config.class)
class BaitlySupplierPurchaseControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlySupplierPurchaseService service(){return mock(BaitlySupplierPurchaseService.class);}
        @Bean BaitlySupplierPurchaseController controller(BaitlySupplierPurchaseService service){return new BaitlySupplierPurchaseController(service);}
        @Bean BaitlySupplierInvitationController invitation(BaitlySupplierPurchaseService service){return new BaitlySupplierInvitationController(service);}
    }
    @Autowired BaitlySupplierPurchaseController controller;
    @Autowired BaitlySupplierInvitationController invitation;
    @Autowired BaitlySupplierPurchaseService service;
    @BeforeEach void resetMocks(){reset(service);}
    Jwt jwt(){return Jwt.withTokenValue("test").header("alg","none").subject("requester").build();}
    void denied(){
        assertThatThrownBy(()->controller.list(jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.create(null,null,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.invite(1,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.expense(1,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.external(1,new BaitlySupplierPurchaseController.SupplierSite("https://example.test"),jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.receipt(1,null,null,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.document(1,"invoice",jwt())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="HOST") void ownerCannotPrepareOrDeclareSupplierPayments(){denied();}
    @Test @WithMockUser(roles="HOUSEKEEPER") void supplierCannotReadOtherInvoices(){denied();}
    @Test void anonymousCannotReadOrAccept(){
        assertThatThrownBy(()->controller.list(jwt())).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(()->invitation.accept(new BaitlySupplierInvitationController.Invitation("token"),jwt())).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
    }
    @Test @WithMockUser(roles="HOST") void acceptanceUsesAuthenticatedSubjectNotAPostedUser(){
        invitation.accept(new BaitlySupplierInvitationController.Invitation("token"),jwt());verify(service).claim("token","requester");
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void staffReadsWithItsOwnIdentity(){controller.list(jwt());verify(service).list("requester");}
    @Test @WithMockUser(roles="SUPER_ADMIN") void unknownDocumentKindCannotBeRead(){
        assertThatThrownBy(()->controller.document(1,"../../other",jwt())).isInstanceOf(IllegalArgumentException.class);verifyNoInteractions(service);
    }
}
