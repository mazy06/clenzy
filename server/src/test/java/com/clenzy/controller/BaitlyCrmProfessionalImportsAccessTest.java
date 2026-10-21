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
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyCrmProfessionalImportsAccessTest.Config.class)
class BaitlyCrmProfessionalImportsAccessTest {
    @Configuration @Import(BaitlyCrmAccessTest.Config.class)
    static class Config {
        @Bean BaitlyCrmProfessionalImports imports(){return mock(BaitlyCrmProfessionalImports.class);}
        @Bean BaitlyCrmProfessionalImportsController controller(BaitlyCrmProfessionalImports imports){return new BaitlyCrmProfessionalImportsController(imports);}
    }
    @Autowired BaitlyCrmProfessionalImports imports;
    @Autowired BaitlyCrmProfessionalImportsController controller;
    @Autowired PermissionService permissions;
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").build();
    @BeforeEach void setup(){reset(imports,permissions);SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,List.of()));}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void readersCannotSearchOrImportIntoCrm(){
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->controller.cities(jwt,"Nantes")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.search(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.confirm(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.reference(jwt,1)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.references(jwt,new BaitlyCrmProfessionalImports.References(List.of(1L)))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(imports);
    }
    @Test void organizationManagersCanUseAllEndpointsWithoutPlatformRoles(){
        when(permissions.checkUserPermission(eq("actor"),anyString())).thenReturn(true);
        controller.cities(jwt,"Nantes");controller.search(jwt,null);controller.confirm(jwt,null);controller.reference(jwt,1);controller.references(jwt,new BaitlyCrmProfessionalImports.References(List.of(1L,2L)));
        verify(imports).cities("actor","Nantes");verify(imports).search("actor",null);verify(imports).importSelection("actor",null);verify(imports).importReference("actor",1);
        verify(imports).importReferences("actor",new BaitlyCrmProfessionalImports.References(List.of(1L,2L)));
    }
    @Test void anonymousCannotAccess(){clear();assertThatThrownBy(()->controller.cities(jwt,"Nantes")).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);verifyNoInteractions(imports);}
}
