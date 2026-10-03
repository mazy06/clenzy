package com.clenzy.service.paymentconnect;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PaymentConnectionReadinessTest {
    final PaymentConnectionRepository connections = mock(PaymentConnectionRepository.class);
    final OrganizationMemberRepository members = mock(OrganizationMemberRepository.class);
    final PaymentConnectionReadiness readiness = new PaymentConnectionReadiness(connections, members);
    PaymentConnection ready() {
        var c = new PaymentConnection(); c.updateCapabilities(true, true, true, true); return c;
    }
    @Test void readyOrganizationCannotCompleteAnIndividualProviderStep() {
        assertThat(readiness.isReady(42L,7L,false)).isFalse();
        verifyNoInteractions(members);
        verify(connections,never()).findByOrganizationIdAndBeneficiaryKey(7L,"organization");
    }
    @Test void onlyOrganizationOwnerOrAdminCanUseItsReadiness() {
        var member = mock(OrganizationMember.class);
        when(members.findByUserId(42L)).thenReturn(Optional.of(member));
        when(member.getOrganizationId()).thenReturn(7L);
        when(member.getRoleInOrg()).thenReturn(OrgMemberRole.OWNER);
        when(connections.findByOrganizationIdAndBeneficiaryKey(7L,"organization")).thenReturn(Optional.of(ready()));
        assertThat(readiness.isReady(42L,7L,true)).isTrue();
        when(member.getOrganizationId()).thenReturn(8L);
        assertThat(readiness.isReady(42L,7L,true)).isFalse();
    }
    @Test void verifiedPersonalAccountIsAcceptedButRevocationRevertsIt() {
        var c = ready();
        when(connections.findByOrganizationIdAndBeneficiaryKey(7L,"user:42")).thenReturn(Optional.of(c));
        assertThat(readiness.isReady(42L,7L,false)).isTrue();
        c.setAuthorized(false);
        assertThat(readiness.isReady(42L,7L,false)).isFalse();
    }
}
