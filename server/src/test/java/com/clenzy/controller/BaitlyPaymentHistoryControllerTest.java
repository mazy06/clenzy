package com.clenzy.controller;

import com.clenzy.model.User;
import com.clenzy.service.BaitlyPaymentHistoryReader;
import com.clenzy.service.PaymentQueryService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes=BaitlyPaymentHistoryControllerTest.Config.class)
class BaitlyPaymentHistoryControllerTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean PaymentQueryService payments(){return mock(PaymentQueryService.class);}
        @Bean BaitlyPaymentHistoryReader reader(){return mock(BaitlyPaymentHistoryReader.class);}
        @Bean BaitlyPaymentHistoryController controller(PaymentQueryService payments,BaitlyPaymentHistoryReader reader){return new BaitlyPaymentHistoryController(reader,payments);}
    }
    @Autowired BaitlyPaymentHistoryController controller;
    @Autowired PaymentQueryService payments;
    @Autowired BaitlyPaymentHistoryReader reader;
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("user-test").claim("email","test@example.invalid")
            .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    @BeforeEach void resetMocks(){reset(payments,reader);}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    void role(String role){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("test","test",List.of(new SimpleGrantedAuthority("ROLE_"+role))));}
    @Test void technicianCannotReadFinancialPages(){
        role("TECHNICIAN");
        assertThatThrownBy(()->controller.page(jwt,0,10,null,null,null,null,null,true)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payments,reader);
    }
    @Test void unknownUserReceivesUnauthorized(){
        role("HOST");
        assertThat(controller.page(jwt,0,10,null,null,null,null,null,true).getStatusCode().value()).isEqualTo(401);
        verifyNoInteractions(reader);
    }
    @Test void hostReadsOnlyThroughScopedReader(){
        role("HOST");var user=new User();when(payments.resolveCurrentUser("user-test","test@example.invalid")).thenReturn(user);
        when(reader.page(user,43L,null,null,null,null,0,10,true)).thenReturn(Map.of("totalElements",0));
        assertThat(controller.page(jwt,0,10,null,43L,null,null,null,true).getStatusCode().value()).isEqualTo(200);
        verify(reader).page(user,43L,null,null,null,null,0,10,true);
    }
    @Test void invalidStatusReturnsBadRequest(){
        role("SUPER_ADMIN");when(payments.resolveCurrentUser(anyString(),anyString())).thenReturn(new User());
        assertThat(controller.page(jwt,0,10,"invalid",null,null,null,null,true).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(reader);
    }
}
