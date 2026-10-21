package com.clenzy.scheduler;

import com.clenzy.booking.service.BookingEngineDepositService;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BaitlyCautionSchedulerTest {
    @Test void failureIsReportedWithoutSkippingAnotherOrganization() {
        var payments=mock(SecurityDepositPaymentService.class);
        var deposits=mock(SecurityDepositRepository.class);
        var reservations=mock(ReservationRepository.class);
        var tenants=mock(TenantScopedExecutor.class);
        var notifications=mock(NotificationService.class);
        var first=new SecurityDeposit();first.setId(1L);first.setOrganizationId(7L);first.setReservationId(70L);
        var second=new SecurityDeposit();second.setId(2L);second.setOrganizationId(8L);second.setReservationId(80L);
        when(deposits.findCleaningReleaseCandidates(any())).thenReturn(List.of(first,second));
        doAnswer(call->{call.getArgument(1,Runnable.class).run();return null;}).when(tenants).runAsOrganization(anyLong(),any());
        when(payments.releaseAfterCleaning(7L,1L)).thenThrow(new IllegalStateException("Stripe indisponible"));
        when(payments.releaseAfterCleaning(8L,2L)).thenReturn(false);
        new BookingCautionScheduler(payments,deposits,reservations,mock(SupervisionActivityService.class),tenants,
                mock(BookingEngineDepositService.class),notifications).releaseExpiredHolds();
        verify(tenants).runAsOrganization(eq(7L),any());verify(tenants).runAsOrganization(eq(8L),any());
        verify(payments).releaseAfterCleaning(8L,2L);
        verify(notifications).notifyAdminsAndManagersByOrgId(eq(7L),any(),anyString(),anyString(),eq("/reservations?highlight=70"));
        verify(reservations).findMissingBookingCautions(any());
        verify(reservations,never()).findById(anyLong()); // Aucun faux succès dans le feed.
    }
}
