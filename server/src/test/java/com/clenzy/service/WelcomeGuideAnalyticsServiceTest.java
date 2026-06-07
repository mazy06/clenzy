package com.clenzy.service;

import com.clenzy.dto.WelcomeGuideStatsDto;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideEvent;
import com.clenzy.model.WelcomeGuideEventType;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.WelcomeGuideEventRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WelcomeGuideAnalyticsServiceTest {

    @Mock private WelcomeGuideEventRepository eventRepository;
    @Mock private WelcomeGuideTokenRepository tokenRepository;
    @Mock private WelcomeGuideRepository guideRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private WelcomeGuideAnalyticsService service() {
        return new WelcomeGuideAnalyticsService(eventRepository, tokenRepository, guideRepository, redisTemplate);
    }

    private WelcomeGuideToken validToken() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(7L);
        guide.setOrganizationId(1L);
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setGuide(guide);
        token.setValidFrom(LocalDateTime.now().minusDays(1));
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        token.setRevoked(false);
        return token;
    }

    @Test
    void record_validToken_savesEvent() {
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken()));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(1L);

        service().record(token, "activity_click", "Musée du Louvre");

        ArgumentCaptor<WelcomeGuideEvent> captor = ArgumentCaptor.forClass(WelcomeGuideEvent.class);
        verify(eventRepository).save(captor.capture());
        WelcomeGuideEvent saved = captor.getValue();
        assertThat(saved.getEventType()).isEqualTo(WelcomeGuideEventType.ACTIVITY_CLICK);
        assertThat(saved.getGuideId()).isEqualTo(7L);
        assertThat(saved.getOrganizationId()).isEqualTo(1L);
        assertThat(saved.getDetail()).isEqualTo("Musée du Louvre");
    }

    @Test
    void record_invalidToken_noOp() {
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.empty());

        service().record(token, "GUIDE_OPENED", null);

        verify(eventRepository, never()).save(any());
    }

    @Test
    void record_unknownType_noOp() {
        UUID token = UUID.randomUUID();

        service().record(token, "NOT_A_REAL_TYPE", null);

        verify(eventRepository, never()).save(any());
        verify(tokenRepository, never()).findByToken(any());
    }

    @Test
    void record_overDailyCap_noOp() {
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken()));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(501L);

        service().record(token, "GUIDE_OPENED", null);

        verify(eventRepository, never()).save(any());
    }

    @Test
    void getStats_ownedGuide_aggregatesCounts() {
        when(guideRepository.findByIdAndOrganizationId(7L, 1L)).thenReturn(Optional.of(new WelcomeGuide()));
        when(eventRepository.countByTypeForGuide(7L)).thenReturn(List.<Object[]>of(
            new Object[]{WelcomeGuideEventType.GUIDE_OPENED, 5L},
            new Object[]{WelcomeGuideEventType.CHAT_MESSAGE, 2L}));
        when(eventRepository.dailyCountForGuide(eq(7L), eq("GUIDE_OPENED"), any()))
            .thenReturn(List.<Object[]>of(new Object[]{"2026-06-01", 3L}, new Object[]{"2026-06-02", 2L}));
        when(eventRepository.topDetailForGuide(eq(7L), eq(WelcomeGuideEventType.ACTIVITY_CLICK), any(Pageable.class)))
            .thenReturn(List.<Object[]>of(new Object[]{"Musée du Louvre", 4L}));

        Optional<WelcomeGuideStatsDto> stats = service().getStats(7L, 1L);

        assertThat(stats).isPresent();
        WelcomeGuideStatsDto dto = stats.get();
        assertThat(dto.totalOpens()).isEqualTo(5L);
        assertThat(dto.chatMessages()).isEqualTo(2L);
        assertThat(dto.activityClicks()).isZero();
        assertThat(dto.dailyOpens()).hasSize(2);
        assertThat(dto.dailyOpens().get(0).date()).isEqualTo("2026-06-01");
        assertThat(dto.topActivities()).hasSize(1);
        assertThat(dto.topActivities().get(0).label()).isEqualTo("Musée du Louvre");
        assertThat(dto.topActivities().get(0).count()).isEqualTo(4L);
    }

    @Test
    void getStats_guideNotInOrg_returnsEmpty() {
        when(guideRepository.findByIdAndOrganizationId(anyLong(), anyLong())).thenReturn(Optional.empty());

        Optional<WelcomeGuideStatsDto> stats = service().getStats(7L, 999L);

        assertThat(stats).isEmpty();
        verify(eventRepository, never()).countByTypeForGuide(anyLong());
    }
}
