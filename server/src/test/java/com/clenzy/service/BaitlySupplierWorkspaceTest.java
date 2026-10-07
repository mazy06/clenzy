package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlySupplierWorkspaceTest {
    @Test void createsOnlyItsOwnUnbilledOrganizationOnceAndDoesNotReplaceAnExistingOrganization() {
        var users=mock(UserRepository.class);var organizations=mock(OrganizationService.class);
        var user=new User();user.setId(42L);user.setEmailVerified(true);user.setStatus(UserStatus.ACTIVE);user.setFirstName("Jean");user.setLastName("Martin");
        when(users.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(user));
        when(organizations.createForUser(user,"Jean Martin",OrganizationType.INDIVIDUAL)).thenAnswer(c->{user.setOrganizationId(777L);return new Organization();});
        var service=new BaitlySupplierWorkspace(users,organizations);service.ensure(42L);service.ensure(42L);
        verify(organizations,times(1)).createForUser(user,"Jean Martin",OrganizationType.INDIVIDUAL);
        verifyNoMoreInteractions(organizations);assertThat(user.getOrganizationId()).isEqualTo(777L);
    }
    @Test void unverifiedIdentityCannotCreateAnOrganization() {
        var users=mock(UserRepository.class);var organizations=mock(OrganizationService.class);var user=new User();user.setId(42L);
        when(users.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(user));
        assertThatThrownBy(()->new BaitlySupplierWorkspace(users,organizations).ensure(42L)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(organizations);
    }
}
