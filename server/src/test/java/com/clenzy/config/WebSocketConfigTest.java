package com.clenzy.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.web.socket.config.annotation.SockJsServiceRegistration;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("WebSocketConfig")
@ExtendWith(MockitoExtension.class)
class WebSocketConfigTest {

    @Mock
    private WebSocketAuthInterceptor authInterceptor;

    @Mock
    private WebSocketSubscribeAuthorizationInterceptor subscribeInterceptor;

    @Mock
    private StompEndpointRegistry registry;

    @Mock
    private StompWebSocketEndpointRegistration endpointRegistration;

    @Test
    @DisplayName("when registering STOMP endpoints - configured CORS origins are applied, never wildcard")
    void whenRegisteringStompEndpoints_thenConfiguredOriginsApplied() {
        WebSocketConfig config = new WebSocketConfig(authInterceptor, subscribeInterceptor,
                "https://app.clenzy.fr, https://clenzy.fr ,");
        when(registry.addEndpoint("/ws")).thenReturn(endpointRegistration);
        when(endpointRegistration.setAllowedOriginPatterns(any(String[].class))).thenReturn(endpointRegistration);
        when(endpointRegistration.withSockJS()).thenReturn(mock(SockJsServiceRegistration.class));

        config.registerStompEndpoints(registry);

        ArgumentCaptor<String[]> originsCaptor = ArgumentCaptor.forClass(String[].class);
        verify(endpointRegistration, times(2)).setAllowedOriginPatterns(originsCaptor.capture());
        for (String[] origins : originsCaptor.getAllValues()) {
            assertThat(origins)
                    .containsExactly("https://app.clenzy.fr", "https://clenzy.fr")
                    .doesNotContain("*");
        }
        verify(endpointRegistration, atLeastOnce()).withSockJS();
    }

    @Test
    @DisplayName("when configuring inbound channel - auth then subscribe authorization interceptors registered")
    void whenConfiguringInboundChannel_thenBothInterceptorsRegistered() {
        WebSocketConfig config = new WebSocketConfig(authInterceptor, subscribeInterceptor,
                "https://app.clenzy.fr");
        ChannelRegistration channelRegistration = mock(ChannelRegistration.class);

        config.configureClientInboundChannel(channelRegistration);

        verify(channelRegistration).interceptors(authInterceptor, subscribeInterceptor);
    }
}
