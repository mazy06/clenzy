package com.clenzy.service;

import com.clenzy.dto.PayoutReminderDto;
import com.clenzy.dto.PayoutScheduleConfigDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Logique du rappel J-1 de reversement : déclenchement uniquement quand demain est
 * un jour de reversement configuré, auto-gen active, sans opt-out ni accusé.
 */
@ExtendWith(MockitoExtension.class)
class PayoutReminderServiceTest {

    // Jeudi 2026-07-14 → demain = 2026-07-15 (jour de reversement configuré).
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-07-14T10:00:00Z"), ZoneOffset.UTC);

    @Mock private PayoutScheduleService payoutScheduleService;
    @Mock private UserUiPreferencesService userPreferences;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private PayoutReminderService service;

    @BeforeEach
    void setUp() {
        service = new PayoutReminderService(payoutScheduleService, userPreferences, objectMapper, CLOCK);
        lenient().when(userPreferences.getAllForUser("kc")).thenReturn(Map.of());
    }

    private void config(boolean autoGen, List<Integer> days) {
        when(payoutScheduleService.getScheduleConfig()).thenReturn(Optional.of(
                new PayoutScheduleConfigDto(1L, days, 2, autoGen, Instant.now())));
    }

    @Test
    void tomorrowIsPayoutDay_noPref_reminderShown() {
        config(true, List.of(1, 15));

        Optional<PayoutReminderDto> reminder = service.currentReminder("kc");

        assertThat(reminder).isPresent();
        assertThat(reminder.get().payoutDate()).isEqualTo(LocalDate.of(2026, 7, 15));
        assertThat(reminder.get().title()).contains("demain");
    }

    @Test
    void autoGenerationOff_noReminder() {
        config(false, List.of(1, 15));
        assertThat(service.currentReminder("kc")).isEmpty();
    }

    @Test
    void tomorrowNotAPayoutDay_noReminder() {
        config(true, List.of(1, 20)); // demain = 15, pas dans la liste
        assertThat(service.currentReminder("kc")).isEmpty();
    }

    @Test
    void noConfig_noReminder() {
        when(payoutScheduleService.getScheduleConfig()).thenReturn(Optional.empty());
        assertThat(service.currentReminder("kc")).isEmpty();
    }

    @Test
    void optedOut_noReminder() {
        config(true, List.of(15));
        JsonNode pref = objectMapper.createObjectNode().put("optOut", true);
        when(userPreferences.getAllForUser("kc")).thenReturn(Map.of("payout_reminder", pref));

        assertThat(service.currentReminder("kc")).isEmpty();
    }

    @Test
    void alreadyAcknowledgedForThisDate_noReminder() {
        config(true, List.of(15));
        JsonNode pref = objectMapper.createObjectNode().put("ackedDate", "2026-07-15");
        when(userPreferences.getAllForUser("kc")).thenReturn(Map.of("payout_reminder", pref));

        assertThat(service.currentReminder("kc")).isEmpty();
    }

    @Test
    void acknowledge_persistsTomorrowAsAckedDate() {
        service.acknowledge("kc");

        // ackedDate = demain (2026-07-15), optOut inchangé (false).
        org.mockito.Mockito.verify(userPreferences).upsert(
                org.mockito.ArgumentMatchers.eq("kc"),
                org.mockito.ArgumentMatchers.eq("payout_reminder"),
                org.mockito.ArgumentMatchers.contains("2026-07-15"));
    }

    @Test
    void optOut_persistsOptOutTrue() {
        service.optOut("kc");

        org.mockito.Mockito.verify(userPreferences).upsert(
                org.mockito.ArgumentMatchers.eq("kc"),
                org.mockito.ArgumentMatchers.eq("payout_reminder"),
                org.mockito.ArgumentMatchers.contains("\"optOut\":true"));
    }
}
