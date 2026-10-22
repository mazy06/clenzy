package com.clenzy.service.signature;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.net.HttpURLConnection;
import java.util.Map;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BaitlySignatureSafetyTest {
    static Stream<Object> invalidIds() {return Stream.of(null, "", "null", "../private", Map.of("secret", "synthetic-private"), -1, 1.25, Double.NaN);}
    @ParameterizedTest @MethodSource("invalidIds") void invalidRemoteIdCannotBecomeSuccess(Object value) {
        assertThatThrownBy(() -> BaitlySignatureSafety.remoteId(value)).isInstanceOf(IllegalStateException.class)
                .hasMessage("Réponse de signature invalide").hasNoCause();
    }
    @ParameterizedTest @ValueSource(strings={"javascript:alert(1)", "http://example.invalid/link", "https://user:secret@example.invalid/link", "private-data"})
    void unsafeSigningLinkIsRejected(String url) {
        assertThatThrownBy(() -> BaitlySignatureSafety.signingUrl(url)).isInstanceOf(IllegalStateException.class).hasNoCause();
    }
    @Test void validReferencesAndSigningQueryArePreserved() {
        assertThat(BaitlySignatureSafety.remoteId(23L)).isEqualTo("23");
        assertThat(BaitlySignatureSafety.remoteId("signed-request_42")).isEqualTo("signed-request_42");
        String url = "https://sign.example.invalid/sign?token=synthetic-value%2B42";
        assertThat(BaitlySignatureSafety.signingUrl(url)).isEqualTo(url);
    }
    @ParameterizedTest @ValueSource(strings={"https://foreign.example.invalid/document", "http://sign.example.invalid/document", "https://sign.example.invalid:444/document", "https://user:secret@sign.example.invalid/document", "//foreign.example.invalid/document"})
    void apiCredentialCannotBeForwardedOutsideConfiguredOrigin(String target) {
        var downloads = new BaitlySignatureDownloads();
        var http = (RestTemplate) ReflectionTestUtils.getField(downloads, "http");
        var server = MockRestServiceServer.bindTo(http).build();
        var headers = new HttpHeaders();headers.set("X-Auth-Token", "synthetic-key");
        assertThatThrownBy(() -> downloads.fetchSameOrigin("https://sign.example.invalid", target, headers))
                .isInstanceOf(IllegalStateException.class).hasNoCause();
        server.verify();
    }
    @Test void downloadClientExplicitlyDisablesRedirectFollowing() {
        var downloads = new BaitlySignatureDownloads();
        var http = (RestTemplate) ReflectionTestUtils.getField(downloads, "http");
        var connection = mock(HttpURLConnection.class);
        ReflectionTestUtils.invokeMethod(http.getRequestFactory(), "prepareConnection", connection, "GET");
        var calls = org.mockito.ArgumentCaptor.forClass(Boolean.class);
        verify(connection, atLeastOnce()).setInstanceFollowRedirects(calls.capture());
        assertThat(calls.getAllValues().getLast()).isFalse();
    }
    @Test void redirectsAndPrivateErrorBodiesCannotReturnAClaimedDocument() {
        for (var status : new HttpStatus[]{HttpStatus.FOUND, HttpStatus.INTERNAL_SERVER_ERROR}) {
            var downloads = new BaitlySignatureDownloads();
            var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(downloads, "http")).build();
            server.expect(requestTo("https://sign.example.invalid/doc"))
                    .andRespond(withStatus(status).header("Location", "https://foreign.example.invalid/leak")
                            .body("synthetic-private@example.invalid"));
            assertThatThrownBy(() -> downloads.fetchSameOrigin("https://sign.example.invalid", "https://sign.example.invalid/doc", new HttpHeaders()))
                    .hasMessage("Service de signature temporairement indisponible").hasNoCause();
            server.verify();
        }
    }
    @Test void sameOriginDownloadPreservesBytesAndAuthentication() {
        var downloads = new BaitlySignatureDownloads();
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(downloads, "http")).build();
        server.expect(requestTo("https://sign.example.invalid/doc")).andExpect(header("X-Auth-Token", "synthetic-key"))
                .andRespond(withSuccess("synthetic-document", MediaType.APPLICATION_PDF));
        var headers = new HttpHeaders();headers.set("X-Auth-Token", "synthetic-key");
        assertThat(downloads.fetchSameOrigin("https://sign.example.invalid", "https://sign.example.invalid/doc", headers))
                .isEqualTo("synthetic-document".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        server.verify();
    }
    @Test void emptyDownloadedBodyIsNotAValidSignedDocument() {
        var downloads = new BaitlySignatureDownloads();
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(downloads, "http")).build();
        server.expect(requestTo("https://sign.example.invalid/doc")).andRespond(withSuccess("", MediaType.APPLICATION_PDF));
        assertThatThrownBy(() -> downloads.fetchSameOrigin("https://sign.example.invalid", "https://sign.example.invalid/doc", new HttpHeaders()))
                .isInstanceOf(IllegalStateException.class).hasNoCause();
        server.verify();
    }
}
