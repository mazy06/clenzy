package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyProfessionalDirectory;
import com.clenzy.marketplace.service.BaitlyNationalDirectorySync;
import com.clenzy.marketplace.service.BaitlyDirectoryMapIndex;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
@SpringJUnitConfig(BaitlyProfessionalDirectoryAccessTest.Config.class)
class BaitlyProfessionalDirectoryAccessTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyProfessionalDirectory directory(){return mock(BaitlyProfessionalDirectory.class);}
        @Bean BaitlyDirectoryMapIndex mapIndex(){return mock(BaitlyDirectoryMapIndex.class);}
        @Bean BaitlyDirectoryMapIndexController indexController(BaitlyDirectoryMapIndex index,BaitlyProfessionalDirectory directory){return new BaitlyDirectoryMapIndexController(index,directory);}
        @Bean BaitlyProfessionalDirectoryController controller(BaitlyProfessionalDirectory d){return new BaitlyProfessionalDirectoryController(d);}
        @Bean BaitlyNationalDirectorySync sync(){return mock(BaitlyNationalDirectorySync.class);}
        @Bean com.clenzy.marketplace.service.BaitlyDirectoryCountrySync countrySync(){return mock(com.clenzy.marketplace.service.BaitlyDirectoryCountrySync.class);}
        @Bean BaitlyNationalDirectoryController synchronization(BaitlyNationalDirectorySync sync){return new BaitlyNationalDirectoryController(sync);}
    }
    @Autowired BaitlyProfessionalDirectoryController controller;
    @Autowired BaitlyProfessionalDirectory directory;
    @Autowired BaitlyNationalDirectoryController synchronization;
    @Autowired BaitlyNationalDirectorySync sync;
    @Autowired BaitlyDirectoryMapIndexController indexController;
    @Test void mapTilesAndReferencesRequireAuthentication(){
        assertThatThrownBy(indexController::state).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(()->indexController.tile(0,0,0,1,"","")).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(()->indexController.reference(1)).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        login("HOST");indexController.state();indexController.reference(1);
        verify(directory).mapReference(1);
    }
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").build();
    @BeforeEach void resetMocks(){reset(directory,sync);}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    void login(String role){SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,List.of(new SimpleGrantedAuthority("ROLE_"+role))));}
    @Test void readerCannotManage(){
        login("HOST");controller.list("",0,"","");verify(directory).list("",0,"","","FR");clearInvocations(directory);
        assertThatThrownBy(()->controller.search(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.confirmBusiness(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.confirmBusinesses(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.cities("Paris")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.match(jwt,1)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.confirmPlace(jwt,1,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.suppress(1)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(directory);
    }
    @Test void bothPlatformRolesCanManage(){for(String role:List.of("SUPER_ADMIN","SUPER_MANAGER")){login(role);controller.match(jwt,1);controller.confirmBusinesses(jwt,null);controller.cities("Paris");}verify(directory,times(2)).match("actor",1);verify(directory,times(2)).confirmBusinesses("actor",null);verify(directory,times(2)).cities("Paris");}
    @Test void anonymousCannotRead(){assertThatThrownBy(()->controller.list("",0,"","")).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);verifyNoInteractions(directory);}
    @Test void allAuthenticatedRolesCanReadSharedCoverageButAnonymousCannot(){
        assertThatThrownBy(()->controller.rankedMap("","","",-180,-90,180,90,0,"","PROXIMITY")).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(()->controller.clusters("","","",-180,-90,180,90,"")).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(synchronization::status).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(()->controller.map("","","",-180,-90,180,90,0,"")).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        for(String role:List.of("HOST","TECHNICIAN","HOUSEKEEPER","SUPER_ADMIN","SUPER_MANAGER")){login(role);synchronization.status();controller.map("Paris","CLEANING","",-180,-90,180,90,0,"");controller.clusters("Paris","CLEANING","",-180,-90,180,90,"");}
        verify(directory,times(5)).clusters("Paris","CLEANING","",-180,-90,180,90,"","FR");
        verify(sync,times(5)).status();
        verify(directory,times(5)).map("Paris","CLEANING","",-180,-90,180,90,0,"","FR");
        for(String role:List.of("HOST","TECHNICIAN","HOUSEKEEPER","SUPER_ADMIN","SUPER_MANAGER")){login(role);controller.rankedMap("Paris","CLEANING","",-180,-90,180,90,0,"ANY","CONTACTS");}
        verify(directory,times(5)).rankedMap("Paris","CLEANING","",-180,-90,180,90,0,"ANY","CONTACTS");
    }
}
