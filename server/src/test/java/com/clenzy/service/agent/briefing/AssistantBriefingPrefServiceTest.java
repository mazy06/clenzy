package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.repository.AssistantBriefingPrefRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AssistantBriefingPrefServiceTest {

    private AssistantBriefingPrefRepository repository;
    private AssistantBriefingPrefService service;

    @BeforeEach
    void setUp() {
        repository = mock(AssistantBriefingPrefRepository.class);
        service = new AssistantBriefingPrefService(repository, new ObjectMapper());
        when(repository.save(any(AssistantBriefingPref.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void getDefaultPrefs_returnsSensibleDefaults() {
        AssistantBriefingPref def = service.getDefaultPrefs(1L, "user-x");
        assertTrue(def.isEnabled());
        assertEquals(AssistantBriefingPref.Frequency.DAILY_MORNING, def.getFrequencyEnum());
        assertEquals(LocalTime.of(8, 0), def.getTimeLocal());
        assertEquals("Europe/Paris", def.getTimezone());
        assertEquals(List.of("in_app"), service.parseChannels(def));
    }

    @Test
    void upsert_newUser_createsPref() {
        when(repository.findByKeycloakId("user-x")).thenReturn(Optional.empty());

        AssistantBriefingPref pref = service.upsert(1L, "user-x", true,
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY,
                List.of("email", "in_app"),
                LocalTime.of(9, 30),
                "America/New_York");

        assertEquals(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, pref.getFrequencyEnum());
        assertEquals(LocalTime.of(9, 30), pref.getTimeLocal());
        assertEquals("America/New_York", pref.getTimezone());
        verify(repository).save(any(AssistantBriefingPref.class));
    }

    @Test
    void upsert_existingUser_updates() {
        AssistantBriefingPref existing = new AssistantBriefingPref(1L, "user-x");
        existing.setId(7L);
        existing.setEnabled(false);
        when(repository.findByKeycloakId("user-x")).thenReturn(Optional.of(existing));

        AssistantBriefingPref updated = service.upsert(1L, "user-x", true,
                AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of("whatsapp"),
                LocalTime.of(7, 0),
                "Europe/Paris");

        assertTrue(updated.isEnabled());
        // Aucun second save : c'est le meme objet
        ArgumentCaptor<AssistantBriefingPref> cap =
                ArgumentCaptor.forClass(AssistantBriefingPref.class);
        verify(repository).save(cap.capture());
        assertEquals(7L, cap.getValue().getId());
    }

    @Test
    void upsert_crossOrgMismatch_rejected() {
        AssistantBriefingPref existing = new AssistantBriefingPref(2L, "user-x");
        existing.setId(7L);
        when(repository.findByKeycloakId("user-x")).thenReturn(Optional.of(existing));

        assertThrows(IllegalStateException.class, () -> service.upsert(
                1L, "user-x", true, AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of("in_app"), LocalTime.of(8, 0), "Europe/Paris"));
    }

    @Test
    void upsert_invalidTimezone_throws() {
        assertThrows(IllegalArgumentException.class, () -> service.upsert(
                1L, "user-x", true, AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of("in_app"), LocalTime.of(8, 0), "Mars/Olympus"));
    }

    @Test
    void upsert_unknownChannel_filteredOut() {
        when(repository.findByKeycloakId("user-x")).thenReturn(Optional.empty());

        AssistantBriefingPref pref = service.upsert(1L, "user-x", true,
                AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of("in_app", "carrier-pigeon", "email"),
                LocalTime.of(8, 0),
                "Europe/Paris");

        List<String> parsed = service.parseChannels(pref);
        assertTrue(parsed.contains("in_app"));
        assertTrue(parsed.contains("email"));
        assertFalse(parsed.contains("carrier-pigeon"));
    }

    @Test
    void upsert_emptyChannels_defaultsToInApp() {
        when(repository.findByKeycloakId("user-x")).thenReturn(Optional.empty());

        AssistantBriefingPref pref = service.upsert(1L, "user-x", true,
                AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of(), LocalTime.of(8, 0), "Europe/Paris");

        assertEquals(List.of("in_app"), service.parseChannels(pref));
    }

    @Test
    void parseChannels_malformedJson_fallsBackToInApp() {
        AssistantBriefingPref pref = new AssistantBriefingPref(1L, "user-x");
        pref.setChannels("not json");
        assertEquals(List.of("in_app"), service.parseChannels(pref));
    }

    @Test
    void upsert_nullArgs_rejected() {
        assertThrows(IllegalArgumentException.class, () -> service.upsert(
                null, "user-x", true, AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of("in_app"), LocalTime.of(8, 0), "Europe/Paris"));
        assertThrows(IllegalArgumentException.class, () -> service.upsert(
                1L, "", true, AssistantBriefingPref.Frequency.DAILY_MORNING,
                List.of("in_app"), LocalTime.of(8, 0), "Europe/Paris"));
    }
}
