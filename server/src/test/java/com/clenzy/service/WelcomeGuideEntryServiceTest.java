package com.clenzy.service;

import com.clenzy.dto.GuestbookEntryDto;
import com.clenzy.dto.GuestbookEntryRequest;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideEntry;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.WelcomeGuideEntryRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Anti spam/storage abuse du livre d'or public (Z4B-SECBUGS-05) : plafond
 * journalier par token (Redis) + borne dure par livret (compteur BDD).
 */
@ExtendWith(MockitoExtension.class)
class WelcomeGuideEntryServiceTest {

    @Mock private WelcomeGuideTokenRepository tokenRepository;
    @Mock private WelcomeGuideEntryRepository entryRepository;
    @Mock private WelcomeGuideRepository guideRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private WelcomeGuideEntryService service() {
        return new WelcomeGuideEntryService(tokenRepository, entryRepository, guideRepository, redisTemplate);
    }

    private WelcomeGuideToken validToken() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(7L);
        guide.setOrganizationId(1L);
        guide.setGuestbookEnabled(true);
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setGuide(guide);
        token.setValidFrom(LocalDateTime.now().minusDays(1));
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        token.setRevoked(false);
        return token;
    }

    private GuestbookEntryRequest request() {
        return new GuestbookEntryRequest("Jean Dupont", "Super sejour, merci !", 5);
    }

    @Test
    void whenValidTokenUnderCaps_thenSavesEntry() {
        // Arrange
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken()));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(entryRepository.countByGuideId(7L)).thenReturn(3L);
        when(entryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        Optional<GuestbookEntryDto> result = service().addEntry(token, request());

        // Assert
        assertThat(result).isPresent();
        ArgumentCaptor<WelcomeGuideEntry> captor = ArgumentCaptor.forClass(WelcomeGuideEntry.class);
        verify(entryRepository).save(captor.capture());
        assertThat(captor.getValue().getOrganizationId()).isEqualTo(1L);
        assertThat(captor.getValue().getMessage()).isEqualTo("Super sejour, merci !");
        assertThat(captor.getValue().getRating()).isEqualTo(5);
    }

    @Test
    void whenDailyTokenCapExceeded_thenRefusesWithoutSave() {
        // Arrange
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken()));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(11L);

        // Act
        Optional<GuestbookEntryDto> result = service().addEntry(token, request());

        // Assert
        assertThat(result).isEmpty();
        verify(entryRepository, never()).save(any());
    }

    @Test
    void whenGuideAtMaxEntries_thenRefusesWithoutSave() {
        // Arrange
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken()));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(entryRepository.countByGuideId(7L)).thenReturn(500L);

        // Act
        Optional<GuestbookEntryDto> result = service().addEntry(token, request());

        // Assert
        assertThat(result).isEmpty();
        verify(entryRepository, never()).save(any());
    }

    @Test
    void whenInvalidToken_thenReturnsEmptyWithoutCounting() {
        // Arrange
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.empty());

        // Act
        Optional<GuestbookEntryDto> result = service().addEntry(token, request());

        // Assert
        assertThat(result).isEmpty();
        verify(entryRepository, never()).save(any());
        verify(redisTemplate, never()).opsForValue();
    }

    @Test
    void whenRedisUnavailable_thenGuideCapStillBoundsStorage() {
        // Arrange — Redis HS : le plafond journalier est tolere, la borne BDD reste active
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken()));
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis down"));
        when(entryRepository.countByGuideId(7L)).thenReturn(500L);

        // Act
        Optional<GuestbookEntryDto> result = service().addEntry(token, request());

        // Assert
        assertThat(result).isEmpty();
        verify(entryRepository, never()).save(any());
    }
}
