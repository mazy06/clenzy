package com.clenzy.controller;

import com.clenzy.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyCrmCampaignAccessTest.Config.class)
class BaitlyCrmCampaignAccessTest {
    @Configuration @Import(BaitlyCrmAccessTest.Config.class)
    static class Config {
        @Bean BaitlyCrmCampaigns campaigns(){return mock(BaitlyCrmCampaigns.class);}
        @Bean BaitlyCrmCampaignDelivery delivery(){return mock(BaitlyCrmCampaignDelivery.class);}
        @Bean BaitlyCrmCampaignResponses responses(){return mock(BaitlyCrmCampaignResponses.class);}
        @Bean BaitlyCrmCampaignController campaignController(BaitlyCrmCampaigns c,BaitlyCrmCampaignDelivery d,BaitlyCrmCampaignResponses r){return new BaitlyCrmCampaignController(c,d,r);}
    }
    @Autowired BaitlyCrmCampaignController controller;@Autowired BaitlyCrmCampaigns campaigns;@Autowired BaitlyCrmCampaignDelivery delivery;@Autowired BaitlyCrmCampaignResponses responses;@Autowired PermissionService permissions;
    Jwt jwt;
    @BeforeEach void setup(){reset(campaigns,delivery,responses,permissions);jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").claim("email","actor@example.com").claim("email_verified",false).build();SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of()));}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void readPermissionIsRequired(){assertThatThrownBy(()->controller.list(jwt,0)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(campaigns);}
    @Test void readerCannotPrepareSendCancelOrRecordResponses(){
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);controller.list(jwt,0);verify(campaigns).list("actor",0);
        assertThatThrownBy(()->controller.create(jwt,null)).isInstanceOf(AccessDeniedException.class);assertThatThrownBy(()->controller.dispatch(jwt,1)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.cancel(jwt,1)).isInstanceOf(AccessDeniedException.class);assertThatThrownBy(()->controller.response(jwt,1,null)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(delivery,responses);
    }
    @Test void managementDoesNotImplyCampaignSendingPermission(){
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);
        assertThatThrownBy(()->controller.dispatch(jwt,1)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(delivery);
    }
    @Test void sendUsesVerifiedEmailOnlyAndNeverCallsAuthorizationGrant(){
        when(permissions.checkUserPermission(eq("actor"),anyString())).thenReturn(true);controller.dispatch(jwt,1);verify(delivery).dispatch("actor",1,null);
        Jwt verified=Jwt.withTokenValue("test").header("alg","none").subject("actor").claim("email","actor@example.com").claim("email_verified",true).build();controller.dispatch(verified,2);verify(delivery).dispatch("actor",2,"actor@example.com");verifyNoInteractions(responses);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"SUPER_ADMIN","SUPER_MANAGER"})
    void platformStaffCanReadPrepareAndDispatchCampaigns(String role){
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+role))));
        controller.list(jwt,0);controller.create(jwt,null);controller.dispatch(jwt,1);
        verify(campaigns).list("actor",0);verify(campaigns).create("actor",null);verify(delivery).dispatch("actor",1,null);
    }
}
