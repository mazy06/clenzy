package com.clenzy.service.paymentconnect;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.security.access.AccessDeniedException;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.Scope.*;

class PaymentConnectAccessTest {
    final UserRepository users = mock(UserRepository.class);
    final OrganizationMemberRepository members = mock(OrganizationMemberRepository.class);
    final TenantContext tenant = mock(TenantContext.class);
    final PaymentConnectAccess access = new PaymentConnectAccess(users, members, tenant);
    User user(UserRole role) {
        User u = new User(); u.setId(42L); u.setOrganizationId(7L); u.setRole(role);
        when(users.findByKeycloakId("subject")).thenReturn(Optional.of(u));
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        return u;
    }
    @ParameterizedTest @EnumSource(UserRole.class)
    void everyBusinessRoleCanConfigureItsOwnAccount(UserRole role) {
        user(role);
        var beneficiary = access.resolve("subject", PERSONAL);
        assertThat(beneficiary.userId()).isEqualTo(42L);
        assertThat(beneficiary.key()).isEqualTo("user:42");
    }
    @Test void roleTitleAloneCannotClaimOrganizationMoney() {
        user(UserRole.SUPER_MANAGER);
        assertThatThrownBy(() -> access.resolve("subject", ORGANIZATION)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void organizationOwnerCreatesOrganizationNotPersonalBeneficiary() {
        user(UserRole.SUPER_MANAGER);
        OrganizationMember m = mock(OrganizationMember.class);
        when(m.getOrganizationId()).thenReturn(7L); when(m.getRoleInOrg()).thenReturn(OrgMemberRole.OWNER);
        when(members.findByUserId(42L)).thenReturn(Optional.of(m));
        assertThat(access.resolve("subject", ORGANIZATION).userId()).isNull();
        assertThat(access.resolve("subject", ORGANIZATION).key()).isEqualTo("organization");
    }
    @Test void foreignTenantIsRejected() {
        user(UserRole.HOST).setOrganizationId(8L);
        assertThatThrownBy(() -> access.resolve("subject", PERSONAL)).isInstanceOf(AccessDeniedException.class);
    }
}
