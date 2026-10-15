package com.clenzy.controller;

import com.clenzy.service.AuthSessionService;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyNativeSessionControllerTest {
    private final AuthSessionService sessions=mock(AuthSessionService.class);
    private final BaitlyNativeSessionController controller=new BaitlyNativeSessionController(sessions);
    @Test void invalidRefreshTokenCannotCreateSession() {
        when(sessions.refresh("invalid")).thenReturn(Optional.empty());
        assertThat(controller.refresh(new BaitlyNativeSessionController.RefreshRequest("invalid")).getStatusCode().value()).isEqualTo(401);
    }
    @Test void refreshReturnsRotatedTokensFromConfiguredBackendClient() {
        when(sessions.refresh("old")).thenReturn(Optional.of(new AuthSessionService.RefreshedTokens("access","rotated")));
        assertThat(controller.refresh(new BaitlyNativeSessionController.RefreshRequest("old")).getBody())
            .isEqualTo(java.util.Map.of("access_token","access","refresh_token","rotated"));
    }
    @Test void logoutRevokesSession() {
        controller.logout(new BaitlyNativeSessionController.RefreshRequest("old"));
        verify(sessions).logout("old");
    }
}
