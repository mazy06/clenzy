package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.service.signature.Signer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PennylaneApiService}.
 *
 * <p>Covers signature request creation, status fetching (incl. all status
 * mappings), document download, header bearer auth, and signer mapping.</p>
 *
 * <p>The service instantiates its own {@link RestTemplate}, so we inject the
 * mock via {@link ReflectionTestUtils}.</p>
 */
@ExtendWith(MockitoExtension.class)
class PennylaneApiServiceTest {

    @Mock private PennylaneConfig config;
    @Mock private RestTemplate restTemplate;

    private PennylaneApiService service;

    @BeforeEach
    void setUp() {
        service = new PennylaneApiService(config);
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
    }

    // ===================================================================
    // createSignatureRequest
    // ===================================================================

    @Nested
    @DisplayName("createSignatureRequest")
    class CreateSignatureRequest {

        @Test
        @DisplayName("returns success result with mapped id and signing URL")
        void whenApiSucceeds_thenReturnsSuccessResult() {
            // Arrange
            when(config.getApiUrl()).thenReturn("https://api.pennylane.example");
            when(config.getClientSecret()).thenReturn("secret-xyz");

            Map<String, Object> apiResp = new HashMap<>();
            apiResp.put("id", "sig-req-123");
            apiResp.put("signing_url", "https://sign.example/abc");
            @SuppressWarnings({"unchecked", "rawtypes"})
            ResponseEntity<Map> response = new ResponseEntity<>(apiResp, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST),
                    any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);

            SignatureRequest request = new SignatureRequest(
                    42L, "lease.pdf",
                    List.of(new Signer("a@x.com", "Alice", "owner", 1),
                            new Signer("b@x.com", "Bob", "tenant", 2)),
                    "https://clenzy.fr/callback",
                    99L);

            // Act
            SignatureResult result = service.createSignatureRequest(request);

            // Assert
            assertThat(result.success()).isTrue();
            assertThat(result.signatureRequestId()).isEqualTo("sig-req-123");
            assertThat(result.signingUrl()).isEqualTo("https://sign.example/abc");

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(
                    eq("https://api.pennylane.example/api/v1/signature_requests"),
                    eq(HttpMethod.POST), captor.capture(), eq(Map.class));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
            assertThat(body)
                    .containsEntry("document_id", 42L)
                    .containsEntry("document_name", "lease.pdf")
                    .containsEntry("callback_url", "https://clenzy.fr/callback");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> signers = (List<Map<String, Object>>) body.get("signers");
            assertThat(signers).hasSize(2);
            assertThat(signers.get(0))
                    .containsEntry("email", "a@x.com")
                    .containsEntry("name", "Alice")
                    .containsEntry("role", "owner")
                    .containsEntry("order", 1);

            HttpHeaders headers = captor.getValue().getHeaders();
            assertThat(headers.getFirst("Authorization")).isEqualTo("Bearer secret-xyz");
            assertThat(headers.getContentType().toString()).startsWith("application/json");
        }
    }

    // ===================================================================
    // getSignatureStatus (incl. all status mappings)
    // ===================================================================

    @Nested
    @DisplayName("getSignatureStatus")
    class GetSignatureStatus {

        @SuppressWarnings({"unchecked", "rawtypes"})
        private void stubStatus(String apiStatus) {
            when(config.getApiUrl()).thenReturn("https://api.pennylane.example");
            when(config.getClientSecret()).thenReturn("secret");
            Map<String, Object> body = new HashMap<>();
            body.put("status", apiStatus);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET),
                    any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);
        }

        @Test
        @DisplayName("maps 'pending' to PENDING")
        void whenPending_thenReturnsPending() {
            stubStatus("pending");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.PENDING);
        }

        @Test
        @DisplayName("maps 'sent' to SENT")
        void whenSent_thenReturnsSent() {
            stubStatus("sent");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.SENT);
        }

        @Test
        @DisplayName("maps 'viewed' to VIEWED")
        void whenViewed_thenReturnsViewed() {
            stubStatus("viewed");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.VIEWED);
        }

        @Test
        @DisplayName("maps 'signed' to SIGNED")
        void whenSigned_thenReturnsSigned() {
            stubStatus("signed");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.SIGNED);
        }

        @Test
        @DisplayName("maps 'completed' to SIGNED")
        void whenCompleted_thenReturnsSigned() {
            stubStatus("completed");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.SIGNED);
        }

        @Test
        @DisplayName("maps 'declined' to DECLINED")
        void whenDeclined_thenReturnsDeclined() {
            stubStatus("declined");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.DECLINED);
        }

        @Test
        @DisplayName("maps 'refused' to DECLINED")
        void whenRefused_thenReturnsDeclined() {
            stubStatus("refused");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.DECLINED);
        }

        @Test
        @DisplayName("maps 'expired' to EXPIRED")
        void whenExpired_thenReturnsExpired() {
            stubStatus("expired");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.EXPIRED);
        }

        @Test
        @DisplayName("maps 'cancelled' to CANCELLED")
        void whenCancelled_thenReturnsCancelled() {
            stubStatus("cancelled");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.CANCELLED);
        }

        @Test
        @DisplayName("falls back to PENDING for unknown status")
        void whenUnknown_thenFallsBackToPending() {
            stubStatus("frobulating");
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.PENDING);
        }

        @Test
        @DisplayName("falls back to PENDING when status is null")
        void whenStatusNull_thenReturnsPending() {
            stubStatus(null);
            assertThat(service.getSignatureStatus("req-1"))
                    .isEqualTo(SignatureStatus.PENDING);
        }

        @Test
        @DisplayName("hits expected status URL")
        void whenCalled_thenHitsExpectedUrl() {
            // Arrange
            stubStatus("pending");

            // Act
            service.getSignatureStatus("req-99");

            // Assert
            verify(restTemplate).exchange(
                    eq("https://api.pennylane.example/api/v1/signature_requests/req-99"),
                    eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class));
        }
    }

    // ===================================================================
    // downloadDocument
    // ===================================================================

    @Nested
    @DisplayName("downloadDocument")
    class DownloadDocument {

        @Test
        @DisplayName("returns binary body from /document endpoint")
        void whenCalled_thenReturnsBytes() {
            // Arrange
            when(config.getApiUrl()).thenReturn("https://api.pennylane.example");
            when(config.getClientSecret()).thenReturn("secret");

            byte[] pdf = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // %PDF
            ResponseEntity<byte[]> response = new ResponseEntity<>(pdf, HttpStatus.OK);
            when(restTemplate.exchange(contains("/document"), eq(HttpMethod.GET),
                    any(HttpEntity.class), eq(byte[].class)))
                    .thenReturn(response);

            // Act
            byte[] result = service.downloadDocument("req-7");

            // Assert
            assertThat(result).containsExactly(0x25, 0x50, 0x44, 0x46);
            verify(restTemplate).exchange(
                    eq("https://api.pennylane.example/api/v1/signature_requests/req-7/document"),
                    eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
        }
    }
}
