package com.clenzy.service.agent.batch;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.CalendarEngine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("BatchCalendarService — blocage multi-logements (preview/apply)")
class BatchCalendarServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate FROM = LocalDate.of(2026, 7, 10);
    private static final LocalDate TO = LocalDate.of(2026, 7, 12); // 3 nuits

    @Mock private PropertyRepository propertyRepository;
    @Mock private CalendarEngine calendarEngine;

    private BatchCalendarService service() {
        return new BatchCalendarService(propertyRepository, calendarEngine, CLOCK);
    }

    @Test
    @DisplayName("Preview : OK / CONFLICT / DENIED + token")
    void preview_classifiesAndTokens() {
        stubProperties();
        when(calendarEngine.getDays(eq(5L), any(), any(), eq(ORG))).thenReturn(List.of());
        when(calendarEngine.getDays(eq(6L), any(), any(), eq(ORG)))
                .thenReturn(List.of(day(LocalDate.of(2026, 7, 11), CalendarDayStatus.BOOKED)));

        BatchCalendarService.BatchPreview p =
                service().preview(ORG, List.of(5L, 6L, 7L), FROM, TO, "rénovation");

        assertThat(p.items()).hasSize(3);
        assertThat(p.items()).anySatisfy(i -> {
            assertThat(i.propertyId()).isEqualTo(5L);
            assertThat(i.status()).isEqualTo("OK");
            assertThat(i.daysToBlock()).isEqualTo(3);
        });
        assertThat(p.items()).anySatisfy(i -> assertThat(i.status()).isEqualTo("CONFLICT"));
        assertThat(p.items()).anySatisfy(i -> assertThat(i.status()).isEqualTo("DENIED"));
        assertThat(p.confirmationToken()).isNotBlank();
    }

    @Test
    @DisplayName("Apply : applique l'OK, ignore conflit et non-possédé")
    void apply_appliesOk_skipsConflictAndDenied() {
        stubProperties();
        when(calendarEngine.getDays(eq(5L), any(), any(), eq(ORG))).thenReturn(List.of());
        when(calendarEngine.getDays(eq(6L), any(), any(), eq(ORG)))
                .thenReturn(List.of(day(LocalDate.of(2026, 7, 11), CalendarDayStatus.BOOKED)));
        when(calendarEngine.block(eq(5L), any(), any(), eq(ORG), any(), any(), any()))
                .thenReturn(List.of(new CalendarDay(), new CalendarDay(), new CalendarDay()));
        when(calendarEngine.block(eq(6L), any(), any(), eq(ORG), any(), any(), any()))
                .thenThrow(new CalendarConflictException(6L, FROM, TO, 1L));

        BatchCalendarService svc = service();
        String token = svc.preview(ORG, List.of(5L, 6L, 7L), FROM, TO, "rénovation").confirmationToken();

        BatchCalendarService.BatchApplyResult r =
                svc.apply(ORG, "kc", List.of(5L, 6L, 7L), FROM, TO, "rénovation", token);

        assertThat(r.applied()).isEqualTo(1);
        assertThat(r.skipped()).isEqualTo(2);
    }

    @Test
    @DisplayName("Apply : token absent/incorrect → refus (preview obligatoire)")
    void apply_wrongToken_throws() {
        assertThatThrownBy(() ->
                service().apply(ORG, "kc", List.of(5L, 6L), FROM, TO, null, "deadbeef"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Token");
    }

    private void stubProperties() {
        when(propertyRepository.findById(5L)).thenReturn(Optional.of(property(5L, "Villa A", ORG)));
        when(propertyRepository.findById(6L)).thenReturn(Optional.of(property(6L, "Villa B", ORG)));
        when(propertyRepository.findById(7L)).thenReturn(Optional.of(property(7L, "Foreign", 2L)));
    }

    private static Property property(Long id, String name, Long org) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setOrganizationId(org);
        return p;
    }

    private static CalendarDay day(LocalDate date, CalendarDayStatus status) {
        CalendarDay d = new CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        return d;
    }
}
