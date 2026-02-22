package com.clenzy.service;

import com.clenzy.dto.noise.NoiseAlertConfigDto;
import com.clenzy.dto.noise.SaveNoiseAlertConfigDto;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.repository.NoiseAlertConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseAlertConfigServiceTest {

    @Mock private NoiseAlertConfigRepository configRepository;

    @InjectMocks
    private NoiseAlertConfigService service;

    @Test
    void whenSaveNewConfig_thenCreatesNewEntity() {
        when(configRepository.findByOrganizationIdAndPropertyId(10L, 100L))
            .thenReturn(Optional.empty());
        when(configRepository.save(any(NoiseAlertConfig.class)))
            .thenAnswer(inv -> {
                NoiseAlertConfig c = inv.getArgument(0);
                c.setId(1L);
                return c;
            });

        SaveNoiseAlertConfigDto dto = new SaveNoiseAlertConfigDto(
            true, true, true, false, false, false, 30, null,
            List.of(new SaveNoiseAlertConfigDto.TimeWindowInput("Jour", "07:00", "22:00", 70, 85))
        );

        NoiseAlertConfigDto result = service.save(10L, 100L, dto);

        assertNotNull(result);
        assertEquals(100L, result.propertyId());
        assertTrue(result.enabled());
        assertEquals(1, result.timeWindows().size());
        assertEquals("Jour", result.timeWindows().get(0).label());
    }

    @Test
    void whenSaveExistingConfig_thenUpdatesEntity() {
        NoiseAlertConfig existing = new NoiseAlertConfig();
        existing.setId(1L);
        existing.setOrganizationId(10L);
        existing.setPropertyId(100L);
        existing.setEnabled(false);

        when(configRepository.findByOrganizationIdAndPropertyId(10L, 100L))
            .thenReturn(Optional.of(existing));
        when(configRepository.save(any(NoiseAlertConfig.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        SaveNoiseAlertConfigDto dto = new SaveNoiseAlertConfigDto(
            true, true, false, true, false, false, 60, "admin@example.com",
            List.of(new SaveNoiseAlertConfigDto.TimeWindowInput("Nuit", "22:00", "07:00", 55, 70))
        );

        NoiseAlertConfigDto result = service.save(10L, 100L, dto);

        assertTrue(result.enabled());
        assertTrue(result.notifyGuestMessage());
        assertFalse(result.notifyEmail());
        assertEquals(60, result.cooldownMinutes());
        assertEquals("admin@example.com", result.emailRecipients());
    }

    @Test
    void whenCriticalBelowWarning_thenThrowsException() {
        SaveNoiseAlertConfigDto dto = new SaveNoiseAlertConfigDto(
            true, true, true, false, false, false, 30, null,
            List.of(new SaveNoiseAlertConfigDto.TimeWindowInput("Test", "07:00", "22:00", 80, 70))
        );

        assertThrows(IllegalArgumentException.class, () -> service.save(10L, 100L, dto));
        verify(configRepository, never()).save(any());
    }

    @Test
    void whenDelete_thenRemovesConfig() {
        NoiseAlertConfig existing = new NoiseAlertConfig();
        existing.setId(1L);
        when(configRepository.findByOrganizationIdAndPropertyId(10L, 100L))
            .thenReturn(Optional.of(existing));

        service.delete(10L, 100L);

        verify(configRepository).delete(existing);
    }

    @Test
    void whenDeleteNonExistent_thenDoesNothing() {
        when(configRepository.findByOrganizationIdAndPropertyId(10L, 100L))
            .thenReturn(Optional.empty());

        service.delete(10L, 100L);

        verify(configRepository, never()).delete(any());
    }
}
