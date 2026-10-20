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

@SpringJUnitConfig(BaitlyRecruitmentAccessTest.Config.class)
class BaitlyRecruitmentAccessTest {
    @Configuration @Import(BaitlyCrmAccessTest.Config.class)
    static class Config {
        @Bean BaitlyRecruitment recruitment(){return mock(BaitlyRecruitment.class);}
        @Bean BaitlyRecruitmentController controller(BaitlyRecruitment recruitment){return new BaitlyRecruitmentController(recruitment);}
    }
    @Autowired BaitlyRecruitmentController controller;
    @Autowired PermissionService permissions;
    @Autowired BaitlyRecruitment recruitment;
    Jwt jwt;
    @BeforeEach void setup(){
        reset(permissions,recruitment);jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of()));
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void crmViewPermissionIsRequired(){
        assertThatThrownBy(()->controller.own(jwt)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(recruitment);
    }
    @Test void readOnlyCannotPublish(){
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        controller.own(jwt);verify(recruitment).own("actor");
        assertThatThrownBy(()->controller.save(jwt,null)).isInstanceOf(AccessDeniedException.class);verifyNoMoreInteractions(recruitment);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"SUPER_ADMIN","SUPER_MANAGER"})
    void platformStaffCanReadAndSaveRecruitmentForms(String role){
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+role))));
        controller.own(jwt);controller.save(jwt,null);
        verify(recruitment).own("actor");verify(recruitment).save("actor",null);
    }
}
