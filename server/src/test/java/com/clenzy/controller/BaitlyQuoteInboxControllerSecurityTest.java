package com.clenzy.controller;

import com.clenzy.service.BaitlyQuoteInbox;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyQuoteInboxControllerSecurityTest.Config.class)
class BaitlyQuoteInboxControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyQuoteInbox inbox() { return mock(BaitlyQuoteInbox.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean BaitlyQuoteInboxController controller(BaitlyQuoteInbox inbox, TenantContext tenant) {
            return new BaitlyQuoteInboxController(inbox,tenant);
        }
    }
    @Autowired BaitlyQuoteInboxController controller;
    @Autowired BaitlyQuoteInbox inbox;
    @Autowired TenantContext tenant;
    @BeforeEach void setup() { reset(inbox,tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    @Test @WithAnonymousUser void anonymousCannotReadQuotes() {
        assertThatThrownBy(() -> controller.list(null,"ALL",0,20))
            .isInstanceOfAny(AccessDeniedException.class,AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(inbox);
    }
    @Test @WithMockUser(roles="HOST") void hostUsesServerTenantAndAuthenticatedSubject() {
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("owner-7").build();
        controller.list(jwt,"ACCEPTED",1,20);
        verify(inbox).list(7L,jwt,"ACCEPTED",1,20);
    }
    @Test @WithMockUser(roles="TECHNICIAN") void providersReachOnlyTheAccessFilteredProjection() {
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("provider-3").build();
        controller.list(jwt,"ALL",0,20);
        verify(inbox).list(7L,jwt,"ALL",0,20);
    }
}
