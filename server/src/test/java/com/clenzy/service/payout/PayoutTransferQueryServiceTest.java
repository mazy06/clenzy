package com.clenzy.service.payout;

import com.clenzy.exception.NotFoundException;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PayoutTransferQueryServiceTest {
    private final PayoutTransferRepository transfers = mock(PayoutTransferRepository.class);
    private final PayoutTransferEventRepository events = mock(PayoutTransferEventRepository.class);
    private final BankPayoutObservationRepository bank = mock(BankPayoutObservationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final PayoutTransferQueryService service = new PayoutTransferQueryService(transfers,events,bank,users,organizations, org.mockito.Mockito.mock(com.clenzy.repository.BaitlyTransferRecoveryRepository.class), org.mockito.Mockito.mock(com.clenzy.repository.BaitlyCommerceRecoveryRepository.class));
    @Test void missingOrForeignTransferDoesNotExposeItsEvents() {
        assertThatThrownBy(() -> service.detail(8L,1L)).isInstanceOf(NotFoundException.class);
        verify(transfers).findByIdAndOrganizationId(1L,8L);
        verifyNoInteractions(events,bank,users,organizations);
    }
    @Test void invalidPaginationOrMissingTenantNeverReadsFinancialData() {
        assertThatThrownBy(() -> service.list(null,0,25)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(7L,-1,25)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(7L,0,101)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(transfers,events);
    }
}
