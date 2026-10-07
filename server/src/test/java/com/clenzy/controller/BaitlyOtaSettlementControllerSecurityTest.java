package com.clenzy.controller;

import com.clenzy.service.BaitlyOtaSettlementService;
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

@SpringJUnitConfig(BaitlyOtaSettlementControllerSecurityTest.Config.class)
class BaitlyOtaSettlementControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyOtaSettlementService service(){return mock(BaitlyOtaSettlementService.class);}
        @Bean BaitlyOtaSettlementController controller(BaitlyOtaSettlementService service){return new BaitlyOtaSettlementController(service);}
    }
    @Autowired BaitlyOtaSettlementController controller;
    @Autowired BaitlyOtaSettlementService service;
    @BeforeEach void resetMocks(){reset(service);}
    Jwt jwt(){return Jwt.withTokenValue("test").header("alg","none").subject("admin").build();}
    void denied(){
        assertThatThrownBy(()->controller.list(1,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.context(1,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.candidates(1,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.record(null,null,null,jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.document(1,"bank",jwt())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.voidRecord(1,new BaitlyOtaSettlementController.Correction("Correction"),jwt())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="HOST") void ownerCannotDeclareAReceipt(){denied();}
    @Test @WithMockUser(roles="HOUSEKEEPER") void providerCannotReadBankDocuments(){denied();}
    @Test void anonymousCannotRead(){assertThatThrownBy(()->controller.list(1,jwt())).isInstanceOf(org.springframework.security.core.AuthenticationException.class);}
    @Test @WithMockUser(roles="SUPER_MANAGER") void staffReadsUsingItsOwnSubject(){controller.list(1,jwt());verify(service).list(1,"admin");}
    @Test @WithMockUser(roles="SUPER_ADMIN") void arbitraryDocumentPathIsRejected(){
        assertThatThrownBy(()->controller.document(1,"../../secret",jwt())).isInstanceOf(IllegalArgumentException.class);verifyNoInteractions(service);
    }
}
