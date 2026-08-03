package com.clenzy.service.messaging;

import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class QuietHoursServiceTest {

    private static final Long ORG_ID = 7L;

    @Mock private GuestMessagingQueryService queryService;
    @Mock private SupervisionActivityService activityService;

    private Reservation reservationInZone(String timezone) {
        Property property = new Property();
        property.setId(42L);
        property.setTimezone(timezone);
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        return reservation;
    }

    private MessagingAutomationConfig config(String start, String end) {
        MessagingAutomationConfig config = new MessagingAutomationConfig(ORG_ID);
        config.setQuietHoursStart(start);
        config.setQuietHoursEnd(end);
        return config;
    }

    private QuietHoursService serviceAt(String utcInstant) {
        return new QuietHoursService(queryService, activityService,
                Clock.fixed(Instant.parse(utcInstant), ZoneId.of("UTC")));
    }

    @Test
    @DisplayName("whenLocalNightInsideWindow_thenDeferredToEndOfWindow")
    void whenLocalNightInsideWindow_thenDeferredToEndOfWindow() {
        // 23:00 UTC = 23:00 heure locale UTC → dans [22:00, 08:00) → reprise demain 08:00.
        when(queryService.getConfigOrDefault(ORG_ID)).thenReturn(config("22:00", "08:00"));
        QuietHoursService service = serviceAt("2026-07-02T23:00:00Z");

        LocalDateTime resumeAt = service.deferUntilIfQuiet(ORG_ID, reservationInZone("UTC"));

        LocalDateTime expected = LocalDateTime.of(2026, 7, 3, 8, 0)
                .atZone(ZoneId.of("UTC"))
                .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        assertThat(resumeAt).isEqualTo(expected);
    }

    @Test
    @DisplayName("whenDaytime_thenNoDeferral")
    void whenDaytime_thenNoDeferral() {
        when(queryService.getConfigOrDefault(ORG_ID)).thenReturn(config("22:00", "08:00"));
        QuietHoursService service = serviceAt("2026-07-02T14:00:00Z");

        assertThat(service.deferUntilIfQuiet(ORG_ID, reservationInZone("UTC"))).isNull();
    }

    @Test
    @DisplayName("whenWindowClearedInSettings_thenFeatureDisabled")
    void whenWindowClearedInSettings_thenFeatureDisabled() {
        when(queryService.getConfigOrDefault(ORG_ID)).thenReturn(config(null, "08:00"));
        QuietHoursService service = serviceAt("2026-07-02T23:00:00Z");

        assertThat(service.deferUntilIfQuiet(ORG_ID, reservationInZone("UTC"))).isNull();
    }

    @Test
    @DisplayName("whenPropertyTimezoneDiffers_thenLocalTimeDecides")
    void whenPropertyTimezoneDiffers_thenLocalTimeDecides() {
        // 23:00 UTC = 12:00 le lendemain a Auckland (UTC+13 en juillet ? non — hiver
        // austral UTC+12) : heure pleine locale → pas de report, meme si nuit UTC.
        when(queryService.getConfigOrDefault(ORG_ID)).thenReturn(config("22:00", "08:00"));
        QuietHoursService service = serviceAt("2026-07-02T23:00:00Z");

        assertThat(service.deferUntilIfQuiet(ORG_ID, reservationInZone("Pacific/Auckland")))
                .isNull();
    }

    @Test
    @DisplayName("isWithinWindow_handlesMidnightCrossing")
    void isWithinWindow_handlesMidnightCrossing() {
        LocalTime start = LocalTime.of(22, 0);
        LocalTime end = LocalTime.of(8, 0);
        assertThat(QuietHoursService.isWithinWindow(LocalTime.of(23, 30), start, end)).isTrue();
        assertThat(QuietHoursService.isWithinWindow(LocalTime.of(3, 0), start, end)).isTrue();
        assertThat(QuietHoursService.isWithinWindow(LocalTime.of(8, 0), start, end)).isFalse();
        assertThat(QuietHoursService.isWithinWindow(LocalTime.of(12, 0), start, end)).isFalse();
        assertThat(QuietHoursService.isWithinWindow(LocalTime.of(22, 0), start, end)).isTrue();
    }

    @Test
    @DisplayName("recordDeferred_writesDeferredTaggedFeedEntry")
    void recordDeferred_writesDeferredTaggedFeedEntry() {
        QuietHoursService service = serviceAt("2026-07-02T23:00:00Z");

        service.recordDeferred(ORG_ID, reservationInZone("UTC"), "com", "Message de bienvenue",
                LocalDateTime.of(2026, 7, 3, 8, 0));

        verify(activityService).recordModuleActTagged(eq(ORG_ID), eq(42L), eq("com"),
                eq("message_deferred_quiet_hours"),
                org.mockito.ArgumentMatchers.contains("08:00"),
                any(), any(), eq(com.clenzy.model.SupervisionActivity.TAG_DEFERRED));
    }
}
