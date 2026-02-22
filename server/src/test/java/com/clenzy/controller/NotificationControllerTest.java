package com.clenzy.controller;

import com.clenzy.dto.NotificationDto;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock private NotificationService notificationService;

    private NotificationController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new NotificationController(notificationService);
    }

    @Nested
    @DisplayName("getAll")
    class GetAll {
        @Test
        void whenGetAll_thenReturnsNotifications() {
            NotificationDto dto = new NotificationDto();
            dto.id = 1L;
            dto.title = "Test";
            when(notificationService.getAllForUser("user-123")).thenReturn(List.of(dto));

            Jwt jwt = createJwt();
            ResponseEntity<List<NotificationDto>> response = controller.getAll(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getUnreadCount")
    class UnreadCount {
        @Test
        void whenGetUnreadCount_thenReturnsCount() {
            when(notificationService.getUnreadCount("user-123")).thenReturn(5L);

            Jwt jwt = createJwt();
            ResponseEntity<Map<String, Long>> response = controller.getUnreadCount(jwt);

            assertThat(response.getBody().get("count")).isEqualTo(5L);
        }
    }

    @Nested
    @DisplayName("markAsRead")
    class MarkAsRead {
        @Test
        void whenMarkAsRead_thenDelegates() {
            NotificationDto dto = new NotificationDto();
            dto.id = 1L;
            when(notificationService.markAsRead(1L, "user-123")).thenReturn(dto);

            Jwt jwt = createJwt();
            ResponseEntity<NotificationDto> response = controller.markAsRead(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("markAllAsRead")
    class MarkAllAsRead {
        @Test
        void whenMarkAllAsRead_thenDelegates() {
            Jwt jwt = createJwt();
            ResponseEntity<Void> response = controller.markAllAsRead(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(notificationService).markAllAsRead("user-123");
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenDelete_thenDelegates() {
            Jwt jwt = createJwt();
            controller.delete(1L, jwt);
            verify(notificationService).delete(1L, "user-123");
        }
    }
}
