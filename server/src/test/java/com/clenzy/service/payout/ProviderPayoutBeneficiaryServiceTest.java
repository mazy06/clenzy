package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderPayoutBeneficiaryServiceTest {
    private final ProviderPayoutBeneficiaryRepository beneficiaries = mock(ProviderPayoutBeneficiaryRepository.class);
    private final HousekeeperPayoutRecordRepository records = mock(HousekeeperPayoutRecordRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ProviderPayoutBeneficiaryService service = new ProviderPayoutBeneficiaryService(beneficiaries, records, users);
    private final ProviderPayoutBeneficiaryRepository.Assignment assignment = mock(ProviderPayoutBeneficiaryRepository.Assignment.class);

    @BeforeEach void setup() {
        when(assignment.getAssignedUserId()).thenReturn(null);
        when(assignment.getTeamId()).thenReturn(null);
        when(assignment.getRecipientUserId()).thenReturn(null);
        when(assignment.getRecipientOrganizationId()).thenReturn(null);
        when(beneficiaries.findAssignment(11L,7L)).thenReturn(Optional.of(assignment));
    }
    @Test void teamWithoutDecisionNeverSelectsAMemberOrHostAccount() {
        when(assignment.getTeamId()).thenReturn(99L);
        when(assignment.getRecipientOrganizationId()).thenReturn(9L);
        assertThat(service.resolve(11L,7L)).isEmpty();
    }
    @Test void personalTeamResolvesItsExplicitPersonalUser() {
        when(assignment.getTeamId()).thenReturn(99L);
        when(assignment.getRecipientUserId()).thenReturn(42L);
        assertThat(service.resolve(11L,7L).orElseThrow().beneficiary()).isEqualTo(PayoutBeneficiary.user(42L));
    }
    @Test void selectedCompanyHasNoPersonalRecipientOrNotification() {
        selectedTeam();
        var result=service.resolve(11L,7L).orElseThrow();
        assertThat(result.beneficiary()).isEqualTo(PayoutBeneficiary.organization(9L));
        assertThat(result.notificationSubject()).isNull();
    }
    @Test void reassignmentInvalidatesTheSelectionInsteadOfReroutingFunds() {
        selectedTeam();
        when(assignment.getTeamId()).thenReturn(100L);
        assertThatThrownBy(() -> service.resolve(11L,7L)).isInstanceOf(IllegalStateException.class);
    }
    @Test void recipientOrganizationCannotBeSuppliedArbitrarily() {
        when(assignment.getRecipientOrganizationId()).thenReturn(9L);
        assertThatThrownBy(() -> service.selectOrganization(11L,7L,8L,"admin")).isInstanceOf(IllegalArgumentException.class);
        verify(beneficiaries,never()).saveAndFlush(any());
    }
    @Test void selectionIsLockedAndAuditedBeforeAnyPayout() {
        when(assignment.getRecipientOrganizationId()).thenReturn(9L);
        when(assignment.getTeamId()).thenReturn(99L);
        var actor=new User(); actor.setId(43L);
        when(users.findByKeycloakId("admin")).thenReturn(Optional.of(actor));
        service.selectOrganization(11L,7L,9L,"admin");
        var order=inOrder(beneficiaries,records);
        order.verify(beneficiaries).lockMission(11L);
        order.verify(beneficiaries).findAssignment(11L,7L);
        order.verify(beneficiaries).findByInterventionIdAndOrganizationId(11L,7L);
        order.verify(records).findByInterventionId(11L);
        order.verify(beneficiaries).saveAndFlush(argThat(b -> b.getBeneficiaryOrganizationId().equals(9L)
                && b.getTeamId().equals(99L) && b.getSelectedByUserId().equals(43L) && b.getSelectedAt()!=null));
    }
    @Test void existingPayoutPreventsChangingFromAPersonToACompany() {
        when(assignment.getRecipientOrganizationId()).thenReturn(9L);
        when(records.findByInterventionId(11L)).thenReturn(Optional.of(new HousekeeperPayoutRecord()));
        assertThatThrownBy(() -> service.selectOrganization(11L,7L,9L,"admin")).isInstanceOf(IllegalStateException.class);
        verify(beneficiaries,never()).saveAndFlush(any());
    }
    @Test void anotherTenantCannotSelectOrReadTheBeneficiary() {
        assertThatThrownBy(() -> service.selectOrganization(11L,8L,9L,"admin")).isInstanceOf(com.clenzy.exception.NotFoundException.class);
        assertThatThrownBy(() -> service.resolve(11L,8L)).isInstanceOf(com.clenzy.exception.NotFoundException.class);
        verify(beneficiaries,never()).saveAndFlush(any());
    }
    @Test void prepareUsesSameLockAndRejectsStaleBeneficiary() {
        selectedTeam();
        assertThatThrownBy(() -> service.lockAndRequireRecipient(11L,7L,PayoutBeneficiary.user(42L)))
                .isInstanceOf(IllegalStateException.class);
        verify(beneficiaries).lockMission(11L);
    }
    private void selectedTeam() {
        when(assignment.getTeamId()).thenReturn(99L);
        when(assignment.getRecipientOrganizationId()).thenReturn(9L);
        when(beneficiaries.findByInterventionIdAndOrganizationId(11L,7L))
                .thenReturn(Optional.of(new ProviderPayoutBeneficiary(11L,7L,9L,null,99L,43L)));
    }
}
