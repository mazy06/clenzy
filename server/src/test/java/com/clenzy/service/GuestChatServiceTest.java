package com.clenzy.service;

import com.clenzy.config.GuideConfig;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.service.KeySource;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.WelcomeGuideService.GuestChatContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestChatServiceTest {

    @Mock private WelcomeGuideService welcomeGuideService;
    @Mock private AiProviderRouter aiProviderRouter;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private AiTokenBudgetService tokenBudgetService;

    private GuestChatService service;

    @BeforeEach
    void setUp() {
        service = new GuestChatService(
            welcomeGuideService, aiProviderRouter, redisTemplate, new GuideConfig(), tokenBudgetService,
                new io.micrometer.core.instrument.simple.SimpleMeterRegistry());
    }

    @Test
    void answer_validToken_returnsReply() {
        UUID token = UUID.randomUUID();
        when(welcomeGuideService.getChatContext(token))
            .thenReturn(Optional.of(new GuestChatContext(1L, "fr", "Wi-Fi (réseau) : Maison")));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(aiProviderRouter.route(eq(1L), anyString(), any(), any()))
            .thenReturn(new RoutedResponse(
                new AiResponse("Le réseau Wi-Fi est Maison.", 10, 8, 18, "m", "stop"),
                "anthropic", KeySource.PLATFORM_DB));

        GuestChatService.GuestChatResult result = service.answer(token, "C'est quoi le wifi ?");

        assertThat(result.status()).isEqualTo(GuestChatService.Status.OK);
        assertThat(result.reply()).contains("Maison");
    }

    @Test
    void answer_invalidToken_returnsInvalid() {
        UUID token = UUID.randomUUID();
        when(welcomeGuideService.getChatContext(token)).thenReturn(Optional.empty());

        GuestChatService.GuestChatResult result = service.answer(token, "?");

        assertThat(result.status()).isEqualTo(GuestChatService.Status.INVALID);
    }

    @Test
    void answer_aiUnavailable_returnsGracefulFallback() {
        UUID token = UUID.randomUUID();
        when(welcomeGuideService.getChatContext(token))
            .thenReturn(Optional.of(new GuestChatContext(1L, "fr", "x")));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(aiProviderRouter.route(eq(1L), anyString(), any(), any()))
            .thenThrow(new RuntimeException("AI_NOT_CONFIGURED"));

        GuestChatService.GuestChatResult result = service.answer(token, "?");

        assertThat(result.status()).isEqualTo(GuestChatService.Status.UNAVAILABLE);
        assertThat(result.reply()).isNotBlank();
    }
}
