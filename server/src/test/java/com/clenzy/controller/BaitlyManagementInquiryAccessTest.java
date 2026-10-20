package com.clenzy.controller;

import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
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

@SpringJUnitConfig(BaitlyManagementInquiryAccessTest.Config.class)
class BaitlyManagementInquiryAccessTest {
    @Configuration @Import(BaitlyCrmAccessTest.Config.class)
    static class Config {
        @Bean BaitlyManagementInquiries inquiries(){return mock(BaitlyManagementInquiries.class);}
        @Bean BaitlyCrmPublication publication(){return mock(BaitlyCrmPublication.class);}
        @Bean BaitlyManagementInquiryController inquiryController(BaitlyManagementInquiries i,BaitlyCrmAccess a,BaitlyCrmPublication p){return new BaitlyManagementInquiryController(i,a,p);}
    }
    @Autowired BaitlyManagementInquiryController controller;
    @Autowired PermissionService permissions;
    @Autowired OrganizationService organizations;
    @Autowired BaitlyManagementInquiries inquiries;
    @Autowired TenantContext tenant;
    @Autowired BaitlyCrmPublication publication;
    Jwt jwt;
    @BeforeEach void setup(){
        reset(permissions,organizations,inquiries,publication);tenant.setOrganizationId(10L);
        jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of()));
    }
    @AfterEach void clear(){tenant.clear();SecurityContextHolder.clearContext();}
    @Test void crmReadPermissionAndOrganizationManagementAreBothRequired(){
        assertThatThrownBy(() -> controller.list(null,0,jwt)).isInstanceOf(AccessDeniedException.class);
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        doThrow(new AccessDeniedException("Other org")).when(organizations).validateOrgManagement("actor",10L);
        assertThatThrownBy(() -> controller.list(null,0,jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(inquiries);
    }
    @Test void readOnlyCannotChangeStatusOrPublish(){
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        controller.list(null,0,jwt);verify(inquiries).list(null,0);
        assertThatThrownBy(() -> controller.status(1L,new BaitlyManagementInquiryController.Status("CLOSED"),jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.publish(null,jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoMoreInteractions(inquiries);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"SUPER_ADMIN","SUPER_MANAGER"})
    void platformStaffCanReadAndSaveConciergeForms(String role){
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+role))));
        controller.publication(jwt);controller.publish(null,jwt);
        verify(publication).own("actor");verify(publication).publish(null,"actor");
    }
}
