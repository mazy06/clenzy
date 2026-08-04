package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionConfigDto;
import com.clenzy.dto.SupervisionModuleDto;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Garde de responsabilité : la PLEINE autonomie d'un agent (il agit seul ET en
 * silence) n'est atteignable qu'avec une acceptation TRACÉE — auteur, instant,
 * version du texte. Sans cette trace, le passage en FULL est refusé, y compris
 * par appel direct à l'API (la garde ne vit pas que dans l'interface).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SupervisionFullAutonomyConsentTest {

    private static final Long ORG_ID = 7L;

    @Mock private SupervisionSettingsRepository settingsRepository;
    @Mock private SupervisionModuleSettingsRepository moduleRepository;

    private SupervisionConfigService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionConfigService(settingsRepository, moduleRepository,
                new SupervisionModuleRegistry());
        when(settingsRepository.findByOrganizationId(ORG_ID))
                .thenReturn(Optional.of(new SupervisionSettings(ORG_ID)));
        when(moduleRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of());
        when(moduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private SupervisionConfigDto configWith(String moduleKey, String autonomy) {
        return new SupervisionConfigDto(true, false, 20,
                List.of(new SupervisionModuleDto(moduleKey, null, true, autonomy, true, null)));
    }

    @Test
    @DisplayName("whenFullRequestedWithoutConsent_thenRefusedAndNothingPersisted")
    void whenFullRequestedWithoutConsent_thenRefusedAndNothingPersisted() {
        when(moduleRepository.findByOrganizationIdAndModuleKey(ORG_ID, "ops"))
                .thenReturn(Optional.of(new SupervisionModuleSettings(
                        ORG_ID, "ops", true, SupervisionAutonomy.NOTIFY)));

        assertThatThrownBy(() -> service.updateConfig(ORG_ID, configWith("ops", "full")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("acceptation explicite");
        verify(moduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("whenConsentRecorded_thenAuthorInstantAndNoticeVersionArePersistedWithFull")
    void whenConsentRecorded_thenAuthorInstantAndNoticeVersionArePersistedWithFull() {
        when(moduleRepository.findByOrganizationIdAndModuleKey(ORG_ID, "ops"))
                .thenReturn(Optional.of(new SupervisionModuleSettings(
                        ORG_ID, "ops", true, SupervisionAutonomy.NOTIFY)));

        service.acceptFullAutonomy(ORG_ID, "ops", "user:kc-9", "2026-08-v1");

        ArgumentCaptor<SupervisionModuleSettings> saved =
                ArgumentCaptor.forClass(SupervisionModuleSettings.class);
        verify(moduleRepository).save(saved.capture());
        assertThat(saved.getValue().getAutonomyLevel()).isEqualTo(SupervisionAutonomy.FULL);
        assertThat(saved.getValue().getFullAutonomyAcceptedBy()).isEqualTo("user:kc-9");
        assertThat(saved.getValue().getFullAutonomyNoticeVersion()).isEqualTo("2026-08-v1");
        assertThat(saved.getValue().getFullAutonomyAcceptedAt()).isNotNull();
    }

    @Test
    @DisplayName("whenConsentAlreadyRecorded_thenFullPassesThroughConfigUpdate")
    void whenConsentAlreadyRecorded_thenFullPassesThroughConfigUpdate() {
        SupervisionModuleSettings accepted = new SupervisionModuleSettings(
                ORG_ID, "ops", true, SupervisionAutonomy.NOTIFY);
        accepted.setFullAutonomyAcceptedAt(java.time.Instant.parse("2026-08-01T10:00:00Z"));
        accepted.setFullAutonomyAcceptedBy("user:kc-9");
        when(moduleRepository.findByOrganizationIdAndModuleKey(ORG_ID, "ops"))
                .thenReturn(Optional.of(accepted));

        service.updateConfig(ORG_ID, configWith("ops", "full"));

        assertThat(accepted.getAutonomyLevel()).isEqualTo(SupervisionAutonomy.FULL);
    }

    @Test
    @DisplayName("whenLoweringLevel_thenNoConsentRequired")
    void whenLoweringLevel_thenNoConsentRequired() {
        when(moduleRepository.findByOrganizationIdAndModuleKey(ORG_ID, "ops"))
                .thenReturn(Optional.of(new SupervisionModuleSettings(
                        ORG_ID, "ops", true, SupervisionAutonomy.FULL)));

        service.updateConfig(ORG_ID, configWith("ops", "suggest"));

        verify(moduleRepository).save(any());
    }
}
