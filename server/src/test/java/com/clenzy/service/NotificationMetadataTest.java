package com.clenzy.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationMetadataTest {

    @Test
    void whenNothingIsKnown_thenNoMetadataIsWrittenAtAll() {
        Map<String, Object> facts = NotificationMetadata.of()
                .property(null)
                .guest("")
                .amount(null, "EUR")
                .build();

        assertThat(facts).isNull();
    }

    @Test
    void whenOnlySomeFactsAreKnown_thenTheAbsentOnesAreSkipped() {
        Map<String, Object> facts = NotificationMetadata.of()
                .property("Loft Bastille")
                .guest(null)
                .stay(LocalDate.of(2026, 9, 12), null)
                .build();

        assertThat(facts).containsExactly(
                Map.entry(NotificationMetadata.PROPERTY, "Loft Bastille"),
                Map.entry(NotificationMetadata.CHECK_IN, "2026-09-12"));
    }

    @Test
    void whenAmountIsPresent_thenItsCurrencyTravelsWithIt() {
        Map<String, Object> facts = NotificationMetadata.of()
                .amount(new BigDecimal("120.50"), "MAD")
                .build();

        assertThat(facts).containsEntry(NotificationMetadata.AMOUNT, new BigDecimal("120.50"));
        assertThat(facts).containsEntry(NotificationMetadata.CURRENCY, "MAD");
    }

    @Test
    void whenAmountIsAbsent_thenCurrencyAloneIsMeaningless_andIsDropped() {
        Map<String, Object> facts = NotificationMetadata.of()
                .property("Loft Bastille")
                .amount(null, "EUR")
                .build();

        assertThat(facts).doesNotContainKey(NotificationMetadata.CURRENCY);
    }

    @Test
    void whenSeveralFacts_thenTheEmissionOrderIsPreserved() {
        Map<String, Object> facts = NotificationMetadata.of()
                .property("Loft Bastille")
                .guest("Ada Lovelace")
                .channel("Airbnb")
                .build();

        assertThat(facts.keySet()).containsExactly(
                NotificationMetadata.PROPERTY,
                NotificationMetadata.GUEST,
                NotificationMetadata.CHANNEL);
    }
}
