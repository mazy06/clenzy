package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderPayoutAccountResolverTest {
    private final PaymentConnectionRepository connections = mock(PaymentConnectionRepository.class);
    private final HousekeeperPayoutConfigRepository legacy = mock(HousekeeperPayoutConfigRepository.class);
    private final ProviderPayoutAccountResolver resolver = new ProviderPayoutAccountResolver(connections,legacy);
    private Intervention mission() {
        var user=new User(); user.setId(42L); user.setOrganizationId(9L);
        var mission=new Intervention(); mission.setId(11L); mission.setOrganizationId(7L); mission.setAssignedUser(user);
        return mission;
    }
    @Test void crossOrganizationProviderAccountBelongsToAssigneeNotRequester() {
        var account=mock(PaymentConnectionRepository.ProviderAccount.class);
        when(account.getAccountId()).thenReturn("acct_provider"); when(account.getReady()).thenReturn(true);
        when(connections.findAssignedProviderAccount(11L,7L,42L)).thenReturn(Optional.of(account));
        var resolved=resolver.resolve(mission()).orElseThrow();
        assertThat(resolved.getUserId()).isEqualTo(42L);
        assertThat(resolved.getStripeAccountId()).isEqualTo("acct_provider");
        assertThat(resolved.isOnboardingCompleted()).isTrue();
        verifyNoInteractions(legacy);
    }
    @Test void revokedConnectionCannotFallBackToOldAuthorizedAccount() {
        var account=mock(PaymentConnectionRepository.ProviderAccount.class);
        when(account.getAccountId()).thenReturn("acct_revoked");
        when(connections.findAssignedProviderAccount(11L,7L,42L)).thenReturn(Optional.of(account));
        assertThat(resolver.resolve(mission()).orElseThrow().isOnboardingCompleted()).isFalse();
        verifyNoInteractions(legacy);
    }
    @Test void teamDoesNotSelectAnyMemberAsRecipient() {
        var mission=mission(); mission.setAssignedUser(null); mission.setTeamId(99L);
        assertThat(resolver.resolve(mission)).isEmpty();
        verifyNoInteractions(connections,legacy);
    }
    @Test void companyUsesOnlyItsOrganizationAccount() {
        var account=mock(PaymentConnectionRepository.ProviderAccount.class);
        when(account.getAccountId()).thenReturn("acct_company"); when(account.getReady()).thenReturn(true);
        when(connections.findOrganizationProviderAccount(11L,7L,9L)).thenReturn(Optional.of(account));
        var result=resolver.resolve(mission(),PayoutBeneficiary.organization(9L)).orElseThrow();
        assertThat(result.getStripeAccountId()).isEqualTo("acct_company");
        assertThat(result.getUserId()).isNull();
        verify(connections,never()).findAssignedProviderAccount(any(),any(),any());
        verifyNoInteractions(legacy);
    }
    @Test void missingCompanyAccountCannotFallBackToItsRepresentative() {
        assertThat(resolver.resolve(mission(),PayoutBeneficiary.organization(9L))).isEmpty();
        verify(connections,never()).findAssignedProviderAccount(any(),any(),any());
        verifyNoInteractions(legacy);
    }
}
