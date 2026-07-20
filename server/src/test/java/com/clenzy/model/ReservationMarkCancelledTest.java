package com.clenzy.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ReservationMarkCancelledTest {

    @Test
    void whenMarkCancelled_thenStatusAndTimestampSet() {
        Reservation r = new Reservation();
        r.setStatus("confirmed");

        r.markCancelled();

        assertThat(r.getStatus()).isEqualTo("cancelled");
        assertThat(r.getCancelledAt()).isNotNull();
    }

    @Test
    void whenAlreadyCancelled_thenTimestampNotOverwritten() {
        Reservation r = new Reservation();
        LocalDateTime first = LocalDateTime.of(2026, 7, 1, 10, 0);
        r.setCancelledAt(first);

        r.markCancelled();

        assertThat(r.getCancelledAt()).isEqualTo(first);
    }
}
