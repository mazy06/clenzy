package com.clenzy.controller;
import com.clenzy.config.MethodSecurityConfig;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringJUnitConfig(BaitlyCrmAccessTest.Config.class)
class BaitlyCrmAccessTest {
    @Configuration @EnableMethodSecurity @Import(MethodSecurityConfig.class)
    static class Config {
        @Bean jakarta.persistence.EntityManagerFactory entityManagerFactory() {
            return mock(jakarta.persistence.EntityManagerFactory.class);
        }
        @Bean PermissionService permissions() { return mock(PermissionService.class); }
        @Bean OrganizationService organizations() { return mock(OrganizationService.class); }
        @Bean OrganizationRepository organizationRepository() { return mock(OrganizationRepository.class); }
        @Bean TenantContext tenant() { return new TenantContext(); }
        @Bean BaitlyCrmAccess access(TenantContext t,OrganizationService o,OrganizationRepository r,PermissionService p) { return new BaitlyCrmAccess(t,o,r,p); }
        @Bean ProspectService contacts() { return mock(ProspectService.class); }
        @Bean BaitlyCrmCsvImport importer() { return mock(BaitlyCrmCsvImport.class); }
        @Bean BaitlyCrmContactAuthorizations authorizations() { return mock(BaitlyCrmContactAuthorizations.class); }
        @Bean ProspectController controller(ProspectService p,BaitlyCrmAccess a,BaitlyCrmCsvImport i,BaitlyCrmContactAuthorizations c) { return new ProspectController(p,a,i,c); }
    }
    @Autowired ProspectController controller;
    @Autowired PermissionService permissions;
    @Autowired OrganizationService organizations;
    @Autowired OrganizationRepository organizationRepository;
    @Autowired ProspectService contacts;
    @Autowired BaitlyCrmContactAuthorizations authorizations;
    @Autowired TenantContext tenant;
    @Autowired BaitlyCrmAccess access;
    Jwt jwt;
    @BeforeEach void setup() {
        reset(permissions,organizations,organizationRepository,contacts,authorizations);
        tenant.setOrganizationId(10L);
        jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of()));
    }
    @AfterEach void cleanup() { tenant.clear();SecurityContextHolder.clearContext(); }
    @Test void unauthenticatedAndMissingPermissionCannotRead() {
        assertThatThrownBy(()->controller.all(jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(contacts);
        SecurityContextHolder.clearContext();
        assertThatThrownBy(()->controller.all(jwt))
            .isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
    }
    @Test void permissionAloneDoesNotOpenAnotherOrganizationsCrm() {
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        doThrow(new AccessDeniedException("Not manager")).when(organizations).validateOrgManagement("actor",10L);
        assertThatThrownBy(()->controller.all(jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(contacts);
    }
    @Test void readPermissionDoesNotGrantWritesOrContactAuthorization() {
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        controller.all(jwt);verify(contacts).getAll();
        assertThatThrownBy(()->controller.create(null,jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.authorize(1L,null,jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(organizationRepository,authorizations);
    }
    @Test void authorizedWriteLocksOrganizationBeforeContactMutation() {
        when(permissions.checkUserPermission(eq("actor"),anyString())).thenReturn(true);
        when(organizationRepository.lockById(10L)).thenReturn(java.util.Optional.of(new com.clenzy.model.Organization()));
        controller.archive(1L,jwt);
        var order=inOrder(organizations,organizationRepository,contacts);
        order.verify(organizations).validateOrgManagement("actor",10L);
        order.verify(organizationRepository).lockById(10L);order.verify(contacts).delete(1L);
    }
    @Test void readOnlyCannotRemoveSelections() {
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->controller.archiveSelection(new ProspectController.DeleteSelection(java.util.List.of(1L,2L)),jwt))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(contacts,organizationRepository);
    }
    @Test void bulkRemovalLocksAndValidatesOrganizationBeforeMutation() {
        when(permissions.checkUserPermission(eq("actor"),anyString())).thenReturn(true);
        when(organizationRepository.lockById(10L)).thenReturn(java.util.Optional.of(new com.clenzy.model.Organization()));
        controller.archiveSelection(new ProspectController.DeleteSelection(java.util.List.of(1L,2L)),jwt);
        var order=inOrder(organizations,organizationRepository,contacts);
        order.verify(organizations).validateOrgManagement("actor",10L);
        order.verify(organizationRepository).lockById(10L);order.verify(contacts).deleteMany(java.util.List.of(1L,2L));
    }
    @Test void platformCampaignAccessStillRequiresTheCurrentOrganizationAndItsLock() {
        tenant.setSuperAdmin(true);
        when(organizationRepository.lockById(10L)).thenReturn(java.util.Optional.of(new com.clenzy.model.Organization()));
        assertThat(access.lockForCampaignSend("actor")).isEqualTo(10L);
        verify(organizations).validateOrgManagement("actor",10L);verify(organizationRepository).lockById(10L);
        doThrow(new AccessDeniedException("Denied")).when(organizations).validateOrgManagement("actor",10L);
        assertThatThrownBy(()->access.lockForCampaignSend("actor")).isInstanceOf(AccessDeniedException.class);
    }
}
