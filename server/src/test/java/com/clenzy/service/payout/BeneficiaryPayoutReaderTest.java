package com.clenzy.service.payout;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BeneficiaryPayoutReaderTest {
    final PayoutTransferRepository transfers=mock(PayoutTransferRepository.class);
    final PayoutTransferEventRepository events=mock(PayoutTransferEventRepository.class);
    final BankPayoutObservationRepository bank=mock(BankPayoutObservationRepository.class);
    final BeneficiaryPayoutReader reader=new BeneficiaryPayoutReader(transfers,events,bank, org.mockito.Mockito.mock(com.clenzy.repository.BaitlyTransferRecoveryRepository.class));
    @Test void foreignTransferDoesNotRevealBankOrHistory() {
        when(transfers.findBeneficiaryTransfer(99L,42L,null)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> reader.detail(42L,null,99L)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(events,bank);
    }
    @Test void ownedDetailHidesOperatorAndProviderIdentifiers() throws Exception {
        var transfer=mock(PayoutTransfer.class);
        when(transfer.getId()).thenReturn(12L); when(transfer.getOrganizationId()).thenReturn(7L);
        when(transfer.getState()).thenReturn(PayoutTransfer.State.TRANSFERRED);
        when(transfers.findBeneficiaryTransfer(12L,42L,null)).thenReturn(Optional.of(transfer));
        var event=PayoutTransferEvent.reconciled(transfer,"private-operator-subject");
        when(events.findRecipientHistory(7L,12L)).thenReturn(List.of(event));
        var detail=reader.detail(42L,null,12L);
        verify(bank).findForTransfer(7L,12L);
        var json=new ObjectMapper().findAndRegisterModules().writeValueAsString(detail);
        assertThat(json).contains("TRANSFERRED").doesNotContain("actorSubject","private-operator-subject","destination","organizationId","externalReference");
    }
    @Test void missingOrAmbiguousRecipientAndInvalidPaginationFailClosed() {
        assertThatThrownBy(() -> reader.list(null,null,0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> reader.list(42L,9L,0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> reader.detail(-1L,null,12L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> reader.list(42L,null,-1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> reader.list(42L,null,100001)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(transfers,events,bank);
    }
}
