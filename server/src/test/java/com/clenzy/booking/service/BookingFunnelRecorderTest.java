package com.clenzy.booking.service;

import com.clenzy.model.BookingFunnelEvent;
import com.clenzy.repository.BookingFunnelEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingFunnelRecorderTest {

    @Mock private BookingFunnelEventRepository repository;

    private BookingFunnelRecorder recorder;

    @BeforeEach
    void setUp() {
        recorder = new BookingFunnelRecorder(repository);
    }

    @Test
    void whenRepositoryFails_thenNeverThrowsAndCountsFailure() {
        // Télémétrie best-effort : un échec d'écriture ne remonte JAMAIS à l'appelant.
        when(repository.save(any())).thenThrow(new RuntimeException("db down"));

        assertThatCode(() -> recorder.record(10L, 1L, null,
                BookingFunnelEvent.Type.SEARCH, 42L, null))
                .doesNotThrowAnyException();
        assertThat(recorder.failureCount()).isEqualTo(1L);
    }

    @Test
    void whenSearchNoResult_thenEventPersistedWithWhitelistedPayload() {
        recorder.record(10L, 5L, "a1b2c3d4-e5f6", BookingFunnelEvent.Type.SEARCH_NO_RESULT, 42L,
                BookingFunnelRecorder.stayPayload(
                        LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 15), 4));

        ArgumentCaptor<BookingFunnelEvent> captor = ArgumentCaptor.forClass(BookingFunnelEvent.class);
        verify(repository).save(captor.capture());
        BookingFunnelEvent event = captor.getValue();
        assertThat(event.getEventType()).isEqualTo("SEARCH_NO_RESULT");
        assertThat(event.getOrganizationId()).isEqualTo(10L);
        assertThat(event.getPropertyId()).isEqualTo(42L);
        assertThat(event.getSessionKey()).isEqualTo("a1b2c3d4-e5f6");
        assertThat(event.getPayload())
                .containsEntry("checkIn", "2026-08-10")
                .containsEntry("checkOut", "2026-08-15")
                .containsEntry("nights", 5L)
                .containsEntry("guests", 4);
    }

    @Test
    void whenSessionKeyMalformed_thenDroppedNotStored() {
        // Un header exotique (script, PII, trop long) ne doit jamais atteindre la base.
        assertThat(BookingFunnelRecorder.sanitizeSessionKey("<script>alert(1)</script>")).isNull();
        assertThat(BookingFunnelRecorder.sanitizeSessionKey("john.doe@mail.com")).isNull();
        assertThat(BookingFunnelRecorder.sanitizeSessionKey("x".repeat(65))).isNull();
        assertThat(BookingFunnelRecorder.sanitizeSessionKey("ok-session_123")).isEqualTo("ok-session_123");
    }

    @Test
    void whenPayloadHasNullValues_thenCompacted() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("guests", null);

        recorder.record(10L, null, null, BookingFunnelEvent.Type.VIEW_PROPERTY, 42L, payload);

        ArgumentCaptor<BookingFunnelEvent> captor = ArgumentCaptor.forClass(BookingFunnelEvent.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getPayload()).isNull();
    }
}
