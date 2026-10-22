package com.clenzy.service.signature;

import com.clenzy.integration.docuseal.*;
import com.clenzy.integration.external.YousignSignatureProvider;
import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.clenzy.integration.pennylane.service.PennylaneApiService;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Toutes les valeurs privées de recette sont synthétiques. */
class BaitlySignatureProviderPrivacyTest {
    final String secret = "synthetic-private@example.invalid";
    final RuntimeException failure = new IllegalStateException("access_token=" + secret, new RuntimeException("url=" + secret));
    final RestTemplate http = mock(RestTemplate.class);
    final DocumentGenerationRepository documents = mock(DocumentGenerationRepository.class);
    final DocumentStorageService storage = mock(DocumentStorageService.class);
    final SignatureRequest request = new SignatureRequest(42L, secret, List.of(new Signer(secret, secret, "owner", 1)), null, 7L);

    SignatureProvider provider(String name) {
        var generation = new DocumentGeneration(); generation.setFilePath("synthetic.pdf");
        when(documents.findById(42L)).thenReturn(Optional.of(generation));
        when(storage.loadAsBytes("synthetic.pdf")).thenReturn("%PDF-synthetic".getBytes());
        if (name.equals("docuseal")) {
            var config = new DocuSealConfig(); config.setBaseUrl("https://sign.example.invalid");config.setApiKey("synthetic-key");
            return new DocuSealSignatureProvider(config, documents, storage, http, mock(BaitlySignatureDownloads.class));
        }
        var connections = mock(ExternalServiceConnectionService.class);
        var tenant = mock(TenantContext.class);when(tenant.getOrganizationId()).thenReturn(7L);
        var connection = new ExternalServiceConnection();connection.setStatus(ExternalServiceConnection.Status.ACTIVE);
        when(connections.getConnection(7L, SignatureProviderType.YOUSIGN)).thenReturn(Optional.of(connection));
        when(connections.decryptApiKey(connection)).thenReturn("synthetic-key");
        var downloads = mock(BaitlySignatureDownloads.class);
        when(downloads.fetchSameOrigin(anyString(), anyString(), any())).thenThrow(failure);
        return new YousignSignatureProvider(connections, tenant, documents, storage, http, "https://sign.example.invalid", downloads);
    }

    @ParameterizedTest @ValueSource(strings={"docuseal", "yousign"})
    void creationFailureNeverCopiesProviderErrorOrClaimsSuccess(String name) {
        failure.addSuppressed(new RuntimeException(secret));
        doThrow(failure).when(http).postForObject(anyString(), any(), eq(Map.class));
        var provider = provider(name);
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(provider.getClass());
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>(); logs.start();logger.addAppender(logs);
        try {
            var result = provider.createSignatureRequest(request);
            assertThat(result.success()).isFalse();
            assertThat(result.signatureRequestId()).isNull();
            assertThat(result.signingUrl()).isNull();
            assertThat(result.errorMessage()).isEqualTo(BaitlySignatureSafety.CREATION_UNCONFIRMED);
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(secret, "access_token", "url=");
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {logger.detachAppender(logs);logs.stop();}
    }

    @ParameterizedTest @ValueSource(strings={"docuseal", "yousign"})
    void readFailuresHaveNoProviderCauseGraph(String name) {
        doThrow(failure).when(http).exchange(anyString(), any(org.springframework.http.HttpMethod.class), any(), eq(Map.class));
        var provider = provider(name);
        assertThatThrownBy(() -> provider.getStatus("synthetic-id")).hasMessage("Service de signature temporairement indisponible").hasNoCause();
        assertThatThrownBy(() -> provider.getSignedDocument("synthetic-id")).hasMessage("Service de signature temporairement indisponible").hasNoCause();
    }
    @ParameterizedTest @ValueSource(strings={"docuseal", "yousign"})
    void missingRemoteCreationIdNeverProducesASuccessfulSigningLink(String name) {
        doReturn(new HashMap<String,Object>()).when(http).postForObject(anyString(), any(), eq(Map.class));
        var result = provider(name).createSignatureRequest(request);
        assertThat(result.success()).isFalse();
        assertThat(result.signatureRequestId()).isNull();
        assertThat(result.signingUrl()).isNull();
        verify(http, times(1)).postForObject(anyString(), any(), eq(Map.class));
    }

    @ParameterizedTest @ValueSource(strings={"docuseal", "yousign"})
    void unknownRemoteStatusIsNotConvertedToPending(String name) {
        doReturn(org.springframework.http.ResponseEntity.ok(Map.of("status", secret)))
                .when(http).exchange(anyString(), any(org.springframework.http.HttpMethod.class), any(), eq(Map.class));
        var provider = provider(name);
        assertThatThrownBy(() -> provider.getStatus("synthetic-id")).isInstanceOf(IllegalStateException.class).hasNoCause();
    }

    @ParameterizedTest @ValueSource(strings={"create", "status", "download"})
    void pennylaneFallbacksUseBoundedMessages(String action) {
        var service = new PennylaneApiService(mock(PennylaneConfig.class));
        if (action.equals("create")) {
            SignatureResult result = ReflectionTestUtils.invokeMethod(service, "createSignatureRequestFallback", request, failure);
            assertThat(result.success()).isFalse();
            assertThat(result.errorMessage()).isEqualTo(BaitlySignatureSafety.CREATION_UNCONFIRMED);
        } else {
            assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service,
                    action.equals("status") ? "getSignatureStatusFallback" : "downloadDocumentFallback", secret, failure))
                    .hasMessage("Service de signature temporairement indisponible").hasNoCause();
        }
    }
}
