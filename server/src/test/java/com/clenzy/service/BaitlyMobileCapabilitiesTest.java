package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.marketplace.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.security.oauth2.jwt.Jwt;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class BaitlyMobileCapabilitiesTest {
    final UserService users=mock(UserService.class);
    final ProviderAccountResolver accounts=mock(ProviderAccountResolver.class);
    final BaitlyNetworkService network=mock(BaitlyNetworkService.class);
    final BaitlyMobileWorkService service=new BaitlyMobileWorkService(mock(InterventionRepository.class),mock(InterventionAccessPolicy.class),mock(InterventionMapper.class),mock(InterventionLifecycleService.class),mock(InterventionProgressService.class),accounts,network,users,mock(MarketplaceServiceItemRepository.class),mock(InterventionPhotoRepository.class),mock(PhotoStorageService.class),mock(BaitlyMissionWorkflow.class));
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("worker").build();
    @BeforeEach void noProviderProfile(){when(accounts.providerIdOrNull("worker")).thenReturn(null);}
    void role(UserRole role){var user=new User();user.setRole(role);when(users.findByKeycloakId("worker")).thenReturn(user);}
    @Test void platformAdminHasManagementSpaceWithoutBecomingAnAssignedProvider(){
        role(UserRole.SUPER_ADMIN);var access=service.capabilities(jwt);
        assertTrue(access.canViewOwnerSpace());assertFalse(access.canQuote());assertFalse(access.canExecuteAssignedMission());
    }
    @Test void technicianWithoutCatalogProfileKeepsMinimalFieldAccess(){
        role(UserRole.TECHNICIAN);var access=service.capabilities(jwt);
        assertFalse(access.canViewOwnerSpace());assertTrue(access.canExecuteAssignedMission());assertFalse(access.canQuote());
    }
    @Test void propertyOwnerIsRecognizedAndProviderProfileIsTheSourceOfQuoteAccess(){
        role(UserRole.PROPERTY_OWNER);assertTrue(service.capabilities(jwt).canViewOwnerSpace());assertFalse(service.capabilities(jwt).canQuote());
        when(accounts.providerIdOrNull("worker")).thenReturn(3L);assertTrue(service.capabilities(jwt).canQuote());
    }
    @Test void actualOrganizationManagementPermissionOpensTheManagementSpace(){
        role(UserRole.SUPERVISOR);when(network.canManage("worker")).thenReturn(true);
        assertTrue(service.capabilities(jwt).canViewOwnerSpace());assertTrue(service.capabilities(jwt).canManagePrivateNetwork());
    }
}
