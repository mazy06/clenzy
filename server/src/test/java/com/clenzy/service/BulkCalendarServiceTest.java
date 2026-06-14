package com.clenzy.service;

import com.clenzy.dto.BulkCalendarOperation;
import com.clenzy.dto.BulkCalendarRequest;
import com.clenzy.dto.BulkCalendarResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Édition groupée calendrier (CLZ-P0-10) : une opération par propriété, tolérante aux échecs partiels.
 */
@ExtendWith(MockitoExtension.class)
class BulkCalendarServiceTest {

    @Mock CalendarEngine calendarEngine;
    @InjectMocks BulkCalendarService service;

    private static final Long ORG_ID = 1L;

    @Test
    void appliesBlockToAllProperties_tolerantToPartialFailure() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 5);
        // La propriete 2 echoue : le lot doit continuer. lenient() car les appels 1L/3L
        // (args != eq(2L)) ne matchent pas ce stub et doivent retomber sur le defaut (succes),
        // sans declencher le strict-stubbing Mockito.
        lenient().when(calendarEngine.block(eq(2L), any(), any(), eq(ORG_ID), any(), any(), any()))
            .thenThrow(new RuntimeException("hors org"));

        BulkCalendarRequest request = new BulkCalendarRequest(
            BulkCalendarOperation.BLOCK, List.of(1L, 2L, 3L), from, to, null, "maintenance");

        BulkCalendarResult result = service.apply(request, ORG_ID, "actor");

        assertThat(result.total()).isEqualTo(3);
        assertThat(result.succeeded()).isEqualTo(2);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.items()).anyMatch(i -> i.propertyId().equals(2L) && !i.success());
        verify(calendarEngine).block(eq(1L), any(), any(), eq(ORG_ID), any(), any(), any());
        verify(calendarEngine).block(eq(3L), any(), any(), eq(ORG_ID), any(), any(), any());
    }

    @Test
    void appliesPricePerProperty() {
        BulkCalendarRequest request = new BulkCalendarRequest(
            BulkCalendarOperation.PRICE, List.of(7L), LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5),
            new BigDecimal("120"), null);

        BulkCalendarResult result = service.apply(request, ORG_ID, "actor");

        assertThat(result.succeeded()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(0);
        verify(calendarEngine).updatePrice(eq(7L), any(), any(), eq(new BigDecimal("120")), eq(ORG_ID), eq("actor"));
    }

    @Test
    void appliesUnblockPerProperty() {
        BulkCalendarRequest request = new BulkCalendarRequest(
            BulkCalendarOperation.UNBLOCK, List.of(5L, 6L), LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5),
            null, null);

        BulkCalendarResult result = service.apply(request, ORG_ID, "actor");

        assertThat(result.succeeded()).isEqualTo(2);
        verify(calendarEngine).unblock(eq(5L), any(), any(), eq(ORG_ID), eq("actor"));
        verify(calendarEngine).unblock(eq(6L), any(), any(), eq(ORG_ID), eq("actor"));
    }
}
