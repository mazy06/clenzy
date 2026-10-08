package com.clenzy.service.payout;

import com.clenzy.model.UserRole;
import com.clenzy.service.paymentconnect.PaymentConnectAccess;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.Page;
import org.springframework.security.access.AccessDeniedException;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.Scope.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BeneficiaryPayoutServiceTest {
    final PaymentConnectAccess access=mock(PaymentConnectAccess.class);
    final BeneficiaryPayoutReader reader=mock(BeneficiaryPayoutReader.class);
    final TenantContext tenant=new TenantContext();
    final BeneficiaryPayoutService service=new BeneficiaryPayoutService(access,reader,tenant);
    @BeforeEach void setup() { tenant.clear(); tenant.setOrganizationId(9L); }
    @AfterEach void cleanup() { tenant.clear(); }

    @Test void personalReadUsesAuthenticatedRecipientAcrossSendersThenRestoresTenant() {
        when(access.resolve("subject",PERSONAL)).thenAnswer(invocation -> {
            assertThat(tenant.isSystemOrg()).isFalse();
            return new PaymentConnectAccess.Beneficiary(9L,42L,42L,"user:42","",UserRole.TECHNICIAN);
        });
        when(reader.list(42L,null,0)).thenAnswer(invocation -> {
            assertThat(tenant.isSystemOrg()).isTrue();
            return Page.empty();
        });
        service.list("subject",PERSONAL,0);
        verify(reader).list(42L,null,0);
        assertThat(tenant.isSystemOrg()).isFalse();
        assertThat(tenant.getOrganizationId()).isEqualTo(9L);
    }
    @Test void companyReadUsesAuthorizedOrganizationInsteadOfItsAdministrator() {
        when(access.resolve("owner",ORGANIZATION)).thenReturn(new PaymentConnectAccess.Beneficiary(9L,42L,null,"organization","",UserRole.HOST));
        service.detail("owner",ORGANIZATION,12L);
        verify(reader).detail(null,9L,12L);
        assertThat(tenant.isSystemOrg()).isFalse();
    }
    @Test void rejectedOrganizationAccessNeverEnablesInternalRead() {
        when(access.resolve("ordinary-member",ORGANIZATION)).thenThrow(new AccessDeniedException("denied"));
        assertThatThrownBy(() -> service.list("ordinary-member",ORGANIZATION,0)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(reader);
        assertThat(tenant.isSystemOrg()).isFalse();
    }
    @Test void failedReadRestoresPreviousPrivileges() {
        when(access.resolve("subject",PERSONAL)).thenReturn(new PaymentConnectAccess.Beneficiary(9L,42L,42L,"user:42","",UserRole.TECHNICIAN));
        when(reader.detail(42L,null,99L)).thenThrow(new IllegalStateException("database unavailable"));
        assertThatThrownBy(() -> service.detail("subject",PERSONAL,99L)).isInstanceOf(IllegalStateException.class);
        assertThat(tenant.isSystemOrg()).isFalse();
        tenant.setSystemOrg(true);
        assertThatThrownBy(() -> service.detail("subject",PERSONAL,99L)).isInstanceOf(IllegalStateException.class);
        assertThat(tenant.isSystemOrg()).isTrue();
    }
}
