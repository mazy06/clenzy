package com.clenzy.controller;

import com.clenzy.model.KbDocument;
import com.clenzy.service.agent.kb.IngestionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KbAdminControllerTest {

    @Mock private IngestionService ingestionService;

    private TenantContext tenantContext;
    private KbAdminController controller;

    private static final Long ORG_ID = 12L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        controller = new KbAdminController(ingestionService, tenantContext);
    }

    private Jwt jwt(Map<String, Object> claims) {
        var builder = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject("user-1")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600));
        claims.forEach(builder::claim);
        return builder.build();
    }

    private Jwt jwtWithRoles(String... roles) {
        return jwt(Map.of("realm_access", Map.of("roles", List.of(roles))));
    }

    private Jwt jwtNoRoles() {
        return jwt(Map.of());
    }

    private KbDocument doc(Long id, String src, Long orgId) {
        KbDocument d = new KbDocument(src, "title", "content", "fr", orgId);
        d.setId(id);
        return d;
    }

    // ===================================================================
    // ingest
    // ===================================================================

    @Nested
    @DisplayName("ingest")
    class Ingest {

        @Test
        @DisplayName("throws when file is null")
        void nullFile_throws() {
            assertThatThrownBy(() -> controller.ingest(null, "org", jwtNoRoles()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("file");
        }

        @Test
        @DisplayName("throws when file is empty")
        void emptyFile_throws() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "text/markdown", new byte[0]);

            assertThatThrownBy(() -> controller.ingest(file, "org", jwtNoRoles()))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("throws when file too large")
        void tooLarge_throws() {
            byte[] big = new byte[3 * 1024 * 1024]; // 3 MB
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "text/markdown", big);

            assertThatThrownBy(() -> controller.ingest(file, "org", jwtNoRoles()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("trop");
        }

        @Test
        @DisplayName("throws when content type is not text/* or octet-stream")
        void wrongContentType_throws() {
            MockMultipartFile file = new MockMultipartFile("file", "x.png", "image/png", "data".getBytes());

            assertThatThrownBy(() -> controller.ingest(file, "org", jwtNoRoles()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("non supporte");
        }

        @Test
        @DisplayName("accepts null content type")
        void nullContentType_ok() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", null,
                "# Hi".getBytes());
            KbDocument saved = doc(1L, "x.md", ORG_ID);
            when(ingestionService.ingestMarkdown(eq("x.md"), anyString(), eq(ORG_ID))).thenReturn(saved);

            ResponseEntity<Map<String, Object>> response = controller.ingest(file, "org", jwtNoRoles());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody()).containsEntry("id", 1L).containsEntry("scope", "org");
        }

        @Test
        @DisplayName("accepts application/octet-stream content type")
        void octetStream_ok() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "application/octet-stream",
                "# Hi".getBytes());
            KbDocument saved = doc(1L, "x.md", ORG_ID);
            when(ingestionService.ingestMarkdown(any(), any(), any())).thenReturn(saved);

            ResponseEntity<Map<String, Object>> response = controller.ingest(file, "org", jwtNoRoles());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }

        @Test
        @DisplayName("ingests in org scope by default")
        void orgScope_callsServiceWithOrgId() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "text/markdown", "# X".getBytes());
            KbDocument saved = doc(2L, "x.md", ORG_ID);
            when(ingestionService.ingestMarkdown(eq("x.md"), anyString(), eq(ORG_ID))).thenReturn(saved);

            ResponseEntity<Map<String, Object>> response = controller.ingest(file, "org", jwtNoRoles());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody()).containsEntry("scope", "org");
            verify(ingestionService).ingestMarkdown(eq("x.md"), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("rejects global scope without SUPER_ADMIN/SUPER_MANAGER role")
        void global_withoutAdmin_throws() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "text/markdown", "# X".getBytes());

            assertThatThrownBy(() -> controller.ingest(file, "global", jwtWithRoles("HOST")))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("plateforme");
        }

        @Test
        @DisplayName("allows global scope when SUPER_ADMIN")
        void global_withSuperAdmin_ok() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "text/markdown", "# X".getBytes());
            KbDocument saved = doc(3L, "x.md", null);
            when(ingestionService.ingestMarkdown(eq("x.md"), anyString(), eq(null))).thenReturn(saved);

            ResponseEntity<Map<String, Object>> response =
                controller.ingest(file, "global", jwtWithRoles("SUPER_ADMIN"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody()).containsEntry("scope", "global");
        }

        @Test
        @DisplayName("allows global scope when SUPER_MANAGER")
        void global_withSuperManager_ok() {
            MockMultipartFile file = new MockMultipartFile("file", "x.md", "text/markdown", "# X".getBytes());
            KbDocument saved = doc(3L, "x.md", null);
            when(ingestionService.ingestMarkdown(any(), any(), eq(null))).thenReturn(saved);

            ResponseEntity<Map<String, Object>> response =
                controller.ingest(file, "global", jwtWithRoles("SUPER_MANAGER"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody()).containsEntry("scope", "global");
        }

        @Test
        @DisplayName("falls back to generated filename when original is null")
        void nullFilename_usesFallback() {
            MockMultipartFile file = new MockMultipartFile("file", null, "text/markdown", "# X".getBytes());
            KbDocument saved = doc(4L, "upload-foo.md", ORG_ID);
            when(ingestionService.ingestMarkdown(anyString(), anyString(), eq(ORG_ID))).thenReturn(saved);

            ResponseEntity<Map<String, Object>> response = controller.ingest(file, "org", jwtNoRoles());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }
    }

    // ===================================================================
    // listDocuments
    // ===================================================================

    @Nested
    @DisplayName("listDocuments")
    class ListDocuments {

        @Test
        @DisplayName("returns docs mapped to DTOs with scope")
        void returnsDocsWithScope() {
            KbDocument global = doc(1L, "/g.md", null);
            KbDocument orgDoc = doc(2L, "/o.md", ORG_ID);
            when(ingestionService.listVisibleDocuments(ORG_ID)).thenReturn(List.of(global, orgDoc));

            ResponseEntity<List<Map<String, Object>>> response = controller.listDocuments();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(2);
            assertThat(response.getBody().get(0)).containsEntry("scope", "global");
            assertThat(response.getBody().get(1)).containsEntry("scope", "org");
        }

        @Test
        @DisplayName("empty repo returns empty list")
        void empty_returnsEmpty() {
            when(ingestionService.listVisibleDocuments(ORG_ID)).thenReturn(List.of());

            assertThat(controller.listDocuments().getBody()).isEmpty();
        }
    }

    // ===================================================================
    // delete
    // ===================================================================

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("returns 204 on success")
        void success_returns204() {
            doNothing().when(ingestionService).deleteDocument(1L, ORG_ID, false);

            ResponseEntity<Void> response = controller.delete(1L, jwtWithRoles("HOST"));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            verify(ingestionService).deleteDocument(1L, ORG_ID, false);
        }

        @Test
        @DisplayName("passes isPlatformAdmin=true for SUPER_ADMIN")
        void platformAdmin_passesTrue() {
            controller.delete(1L, jwtWithRoles("SUPER_ADMIN"));

            verify(ingestionService).deleteDocument(1L, ORG_ID, true);
        }

        @Test
        @DisplayName("passes isPlatformAdmin=true for SUPER_MANAGER")
        void superManager_passesTrue() {
            controller.delete(1L, jwtWithRoles("SUPER_MANAGER"));

            verify(ingestionService).deleteDocument(1L, ORG_ID, true);
        }

        @Test
        @DisplayName("handles JWT without realm_access claim")
        void noRealmAccess_passesFalse() {
            controller.delete(1L, jwt(Map.of()));

            verify(ingestionService).deleteDocument(1L, ORG_ID, false);
        }

        @Test
        @DisplayName("handles JWT with malformed roles claim")
        void malformedRoles_passesFalse() {
            controller.delete(1L, jwt(Map.of("realm_access", "not-a-map")));

            verify(ingestionService).deleteDocument(1L, ORG_ID, false);
        }
    }
}
