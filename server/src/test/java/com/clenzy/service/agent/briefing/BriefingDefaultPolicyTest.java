package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.UserPreferences;
import com.clenzy.repository.AssistantBriefingPrefRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserPreferencesRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Politique de briefing par defaut : sans elle, la table des preferences reste
 * vide (les reglages IA ne sont pas exposes aux utilisateurs de l'organisation)
 * et la synthese hebdomadaire ne part jamais.
 */
class BriefingDefaultPolicyTest {

    private static BriefingDefaultPolicy policy() {
        return new BriefingDefaultPolicy(true, "weekly_sunday", "08:00", "in_app", "Europe/Paris");
    }

    @Nested
    class Construction {

        @Test
        void defaults_areWeeklySundayInAppAt8() {
            BriefingDefaultPolicy p = policy();
            assertTrue(p.isEnabled());
            assertEquals(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, p.frequency());
            assertEquals(LocalTime.of(8, 0), p.timeLocal());
            assertEquals(List.of("in_app"), p.channels());
        }

        @Test
        void invalidTime_fallsBackTo8() {
            BriefingDefaultPolicy p = new BriefingDefaultPolicy(
                    true, "weekly_sunday", "pas-une-heure", "in_app", "Europe/Paris");
            assertEquals(LocalTime.of(8, 0), p.timeLocal());
        }

        @Test
        void unknownFrequency_fallsBackToDaily() {
            BriefingDefaultPolicy p = new BriefingDefaultPolicy(
                    true, "n-importe-quoi", "08:00", "in_app", "Europe/Paris");
            assertEquals(AssistantBriefingPref.Frequency.DAILY_MORNING, p.frequency());
        }

        @Test
        void multipleChannels_areParsed() {
            BriefingDefaultPolicy p = new BriefingDefaultPolicy(
                    true, "weekly_sunday", "08:00", "in_app, email", "Europe/Paris");
            assertEquals(List.of("in_app", "email"), p.channels());
        }
    }

    @Nested
    class BuildFor {

        @Test
        void usesUserTimezoneWhenKnown() {
            AssistantBriefingPref pref = policy().buildFor("kc-1", 7L, "Africa/Casablanca");
            assertEquals("Africa/Casablanca", pref.getTimezone());
            assertEquals(7L, pref.getOrganizationId());
            assertEquals("kc-1", pref.getKeycloakId());
            assertTrue(pref.isEnabled());
            assertEquals(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, pref.getFrequencyEnum());
        }

        @Test
        void fallsBackWhenTimezoneUnknownOrInvalid() {
            assertEquals("Europe/Paris", policy().buildFor("kc-1", 7L, null).getTimezone());
            assertEquals("Europe/Paris", policy().buildFor("kc-1", 7L, "Mars/Olympus").getTimezone());
        }

        @Test
        void channelsAreSerializedAsJsonArray() {
            AssistantBriefingPref pref = policy().buildFor("kc-1", 7L, null);
            assertEquals("[\"in_app\"]", pref.getChannels());
        }

        @Test
        void builtPrefIsTransient() {
            // Aucune ligne ne doit etre creee en base : la politique ne fait que
            // decrire, le scheduler consomme l'objet le temps d'un tick.
            assertNull(policy().buildFor("kc-1", 7L, null).getId());
        }
    }

    @Nested
    class EffectivePrefs {

        private AssistantBriefingPrefRepository repository;
        private PropertyRepository propertyRepository;
        private UserPreferencesRepository userPreferencesRepository;
        private AssistantBriefingPrefService service;

        @BeforeEach
        void setUp() {
            repository = mock(AssistantBriefingPrefRepository.class);
            propertyRepository = mock(PropertyRepository.class);
            userPreferencesRepository = mock(UserPreferencesRepository.class);
            service = new AssistantBriefingPrefService(repository, new ObjectMapper(),
                    policy(), propertyRepository, userPreferencesRepository);
            when(repository.findAll()).thenReturn(List.of());
            when(propertyRepository.findBriefingRecipients()).thenReturn(List.of());
            when(userPreferencesRepository.findByKeycloakId(anyString())).thenReturn(Optional.empty());
        }

        private static AssistantBriefingPref stored(String keycloakId, boolean enabled) {
            AssistantBriefingPref p = new AssistantBriefingPref(1L, keycloakId);
            p.setEnabled(enabled);
            return p;
        }

        @Test
        void ownerWithoutPref_getsTheDefault() {
            when(propertyRepository.findBriefingRecipients())
                    .thenReturn(List.<Object[]>of(new Object[]{"owner-1", 3L}));

            List<AssistantBriefingPref> effective = service.listEffectivePrefs();

            assertEquals(1, effective.size());
            assertEquals("owner-1", effective.get(0).getKeycloakId());
            assertEquals(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY,
                    effective.get(0).getFrequencyEnum());
        }

        @Test
        void ownerWithDisabledPref_isNotResubscribed() {
            // Le point critique : une preference DESACTIVEE doit tenir. Sinon un
            // utilisateur ayant coupe ses briefings serait re-abonne au deploiement.
            when(repository.findAll()).thenReturn(List.of(stored("owner-1", false)));
            when(propertyRepository.findBriefingRecipients())
                    .thenReturn(List.<Object[]>of(new Object[]{"owner-1", 3L}));

            assertTrue(service.listEffectivePrefs().isEmpty());
        }

        @Test
        void ownerWithEnabledPref_keepsHisOwnSettings() {
            AssistantBriefingPref own = stored("owner-1", true);
            own.setFrequencyEnum(AssistantBriefingPref.Frequency.ONLY_ALERTS);
            when(repository.findAll()).thenReturn(List.of(own));
            when(propertyRepository.findBriefingRecipients())
                    .thenReturn(List.<Object[]>of(new Object[]{"owner-1", 3L}));

            List<AssistantBriefingPref> effective = service.listEffectivePrefs();

            assertEquals(1, effective.size());
            assertEquals(AssistantBriefingPref.Frequency.ONLY_ALERTS,
                    effective.get(0).getFrequencyEnum());
        }

        @Test
        void sameOwnerListedTwice_yieldsOnlyOnePref() {
            // Un proprietaire present dans deux organisations ne doit pas recevoir
            // deux briefings le meme jour (le verrou d'idempotence est par user+date,
            // le second partirait sinon en SKIPPED bruyant).
            when(propertyRepository.findBriefingRecipients())
                    .thenReturn(List.<Object[]>of(new Object[]{"owner-1", 3L}, new Object[]{"owner-1", 4L}));

            assertEquals(1, service.listEffectivePrefs().size());
        }

        @Test
        void userTimezoneIsUsedForDelivery() {
            UserPreferences prefs = new UserPreferences("owner-1", 3L);
            prefs.setTimezone("Africa/Casablanca");
            when(userPreferencesRepository.findByKeycloakId("owner-1")).thenReturn(Optional.of(prefs));
            when(propertyRepository.findBriefingRecipients())
                    .thenReturn(List.<Object[]>of(new Object[]{"owner-1", 3L}));

            assertEquals("Africa/Casablanca", service.listEffectivePrefs().get(0).getTimezone());
        }

        @Test
        void policyDisabled_keepsOnlyStoredPrefs() {
            AssistantBriefingPrefService withoutPolicy = new AssistantBriefingPrefService(
                    repository, new ObjectMapper(),
                    new BriefingDefaultPolicy(false, "weekly_sunday", "08:00", "in_app", "Europe/Paris"),
                    propertyRepository, userPreferencesRepository);
            when(propertyRepository.findBriefingRecipients())
                    .thenReturn(List.<Object[]>of(new Object[]{"owner-1", 3L}));

            assertTrue(withoutPolicy.listEffectivePrefs().isEmpty());
            verify(propertyRepository, never()).findBriefingRecipients();
        }
    }
}
