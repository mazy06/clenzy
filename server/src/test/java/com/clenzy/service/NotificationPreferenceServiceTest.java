package com.clenzy.service;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.NotificationPreference;
import com.clenzy.repository.NotificationPreferenceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationPreferenceServiceTest {

    @Mock private NotificationPreferenceRepository preferenceRepository;

    private NotificationPreferenceService service;

    @BeforeEach
    void setUp() {
        service = new NotificationPreferenceService(preferenceRepository);
    }

    // ===== GET PREFERENCES =====

    @Nested
    class GetPreferencesForUser {

        @Test
        void whenNoStoredPrefs_thenReturnsAllDefaults() {
            when(preferenceRepository.findByUserId("user-1")).thenReturn(List.of());

            Map<String, Boolean> result = service.getPreferencesForUser("user-1");

            // Should contain all NotificationKey values
            assertThat(result).hasSize(NotificationKey.values().length);
        }

        @Test
        void whenSomePrefsStored_thenMergesWithDefaults() {
            NotificationKey key = NotificationKey.values()[0];
            NotificationPreference pref = new NotificationPreference("user-1", key, false);
            when(preferenceRepository.findByUserId("user-1")).thenReturn(List.of(pref));

            Map<String, Boolean> result = service.getPreferencesForUser("user-1");

            assertThat(result.get(key.name())).isFalse();
            assertThat(result).hasSize(NotificationKey.values().length);
        }
    }

    // ===== UPDATE PREFERENCES =====

    @Nested
    class UpdatePreferences {

        @Test
        void whenNullMap_thenDoesNothing() {
            service.updatePreferences("user-1", null);
            verify(preferenceRepository, never()).save(any());
        }

        @Test
        void whenEmptyMap_thenDoesNothing() {
            service.updatePreferences("user-1", Map.of());
            verify(preferenceRepository, never()).save(any());
        }

        @Test
        void whenExistingPref_thenUpdates() {
            NotificationKey key = NotificationKey.values()[0];
            NotificationPreference existing = new NotificationPreference("user-1", key, true);
            when(preferenceRepository.findByUserIdAndNotificationKey("user-1", key))
                    .thenReturn(Optional.of(existing));

            service.updatePreferences("user-1", Map.of(key.name(), false));

            ArgumentCaptor<NotificationPreference> captor = ArgumentCaptor.forClass(NotificationPreference.class);
            verify(preferenceRepository).save(captor.capture());
            assertThat(captor.getValue().isEnabled()).isFalse();
        }

        @Test
        void whenNewPref_thenCreates() {
            NotificationKey key = NotificationKey.values()[0];
            when(preferenceRepository.findByUserIdAndNotificationKey("user-1", key))
                    .thenReturn(Optional.empty());

            service.updatePreferences("user-1", Map.of(key.name(), true));

            verify(preferenceRepository).save(any(NotificationPreference.class));
        }

        @Test
        void whenUnknownKey_thenIgnored() {
            service.updatePreferences("user-1", Map.of("UNKNOWN_KEY_XYZ", true));

            verify(preferenceRepository, never()).save(any());
        }
    }

    // ===== IS ENABLED =====

    @Nested
    class IsEnabled {

        @Test
        void whenNullUserId_thenReturnsFalse() {
            assertThat(service.isEnabled(null, NotificationKey.values()[0])).isFalse();
        }

        @Test
        void whenNullKey_thenReturnsFalse() {
            assertThat(service.isEnabled("user-1", null)).isFalse();
        }

        @Test
        void whenExplicitlyDisabled_thenReturnsFalse() {
            NotificationKey key = NotificationKey.values()[0];
            when(preferenceRepository.existsByUserIdAndNotificationKeyAndEnabledFalse("user-1", key))
                    .thenReturn(true);

            assertThat(service.isEnabled("user-1", key)).isFalse();
        }

        @Test
        void whenNoStoredPref_thenReturnsDefault() {
            NotificationKey key = NotificationKey.values()[0];
            when(preferenceRepository.existsByUserIdAndNotificationKeyAndEnabledFalse("user-1", key))
                    .thenReturn(false);
            when(preferenceRepository.findByUserIdAndNotificationKey("user-1", key))
                    .thenReturn(Optional.empty());

            boolean result = service.isEnabled("user-1", key);

            assertThat(result).isEqualTo(key.isEnabledByDefault());
        }
    }
}
