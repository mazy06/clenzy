package com.clenzy.controller;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.service.ICalImportService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ICalImportControllerTest {

    @Mock private ICalImportService iCalImportService;

    private ICalImportController controller;

    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ICalImportController(iCalImportService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("preview")
    class Preview {
        @Test
        void whenAllowed_thenReturnsOk() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(true);
            PreviewRequest request = new PreviewRequest();
            request.setUrl("https://example.com/cal.ics");
            request.setPropertyId(1L);
            PreviewResponse previewResponse = mock(PreviewResponse.class);
            when(iCalImportService.previewICalFeed("https://example.com/cal.ics", 1L)).thenReturn(previewResponse);

            ResponseEntity<PreviewResponse> response = controller.preview(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotAllowed_thenThrowsSecurityException() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(false);
            PreviewRequest request = new PreviewRequest();

            assertThatThrownBy(() -> controller.preview(request, jwt))
                    .isInstanceOf(SecurityException.class);
        }
    }

    @Nested
    @DisplayName("importFeed")
    class ImportFeed {
        @Test
        void whenAllowed_thenReturnsCreated() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(true);
            ImportRequest request = new ImportRequest();
            ImportResponse importResponse = mock(ImportResponse.class);
            when(iCalImportService.importICalFeed(request, "user-123")).thenReturn(importResponse);

            ResponseEntity<ImportResponse> response = controller.importFeed(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }
    }

    @Nested
    @DisplayName("getFeeds")
    class GetFeeds {
        @Test
        void whenAllowed_thenReturnsList() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(true);
            FeedDto feed = mock(FeedDto.class);
            when(iCalImportService.getUserFeeds("user-123")).thenReturn(List.of(feed));

            ResponseEntity<List<FeedDto>> response = controller.getFeeds(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("deleteFeed")
    class DeleteFeed {
        @Test
        void whenCalled_thenDelegates() {
            controller.deleteFeed(1L, jwt);

            verify(iCalImportService).deleteFeed(1L, "user-123");
        }
    }

    @Nested
    @DisplayName("toggleAutoInterventions")
    class ToggleAuto {
        @Test
        void whenAllowed_thenReturnsOk() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(true);
            FeedDto feed = mock(FeedDto.class);
            when(iCalImportService.toggleAutoInterventions(1L, "user-123")).thenReturn(feed);

            ResponseEntity<FeedDto> response = controller.toggleAutoInterventions(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("syncFeed")
    class SyncFeed {
        @Test
        void whenCalled_thenReturnsOk() {
            ImportResponse importResponse = mock(ImportResponse.class);
            when(iCalImportService.syncFeed(1L, "user-123")).thenReturn(importResponse);

            ResponseEntity<ImportResponse> response = controller.syncFeed(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("checkAccess")
    class CheckAccess {
        @Test
        void whenAllowed_thenReturnsTrue() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(true);

            ResponseEntity<Map<String, Boolean>> response = controller.checkAccess(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("allowed", true);
        }

        @Test
        void whenNotAllowed_thenReturnsFalse() {
            when(iCalImportService.isUserAllowed("user-123")).thenReturn(false);

            ResponseEntity<Map<String, Boolean>> response = controller.checkAccess(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("allowed", false);
        }
    }
}
