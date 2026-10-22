package com.clenzy.service.signature;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.*;
import java.util.Map;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

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
        var fetcher = mock(com.clenzy.booking.service.PinnedSiteFetcher.class);
        var downloads = new BaitlySignatureDownloads(fetcher);
        assertThatThrownBy(() -> downloads.fetchSameOrigin("https://sign.example.invalid", target, new HttpHeaders()))
                .isInstanceOf(IllegalStateException.class).hasNoCause();
        verifyNoInteractions(fetcher);
    }
    @ParameterizedTest @ValueSource(strings={"https://127.0.0.1", "https://10.0.0.1", "https://192.168.1.1",
            "https://172.16.1.1", "https://169.254.169.254", "https://localhost", "https://[::1]", "http://example.invalid"})
    void privateOrInsecureConfiguredOriginsCannotReceiveCredentials(String origin) {
        var downloads = new BaitlySignatureDownloads(new com.clenzy.booking.service.PinnedSiteFetcher());
        var headers = new HttpHeaders(); headers.setBearerAuth("synthetic-key");
        assertThatThrownBy(() -> downloads.fetchSameOrigin(origin, origin + "/document", headers))
                .hasMessage("Service de signature temporairement indisponible").hasNoCause();
    }
    @Test void transportFailureDoesNotCopyPrivateResponseOrCause() throws Exception {
        var fetcher = mock(com.clenzy.booking.service.PinnedSiteFetcher.class);
        when(fetcher.fetchAuthenticated(anyString(), anyLong(), anyMap()))
                .thenThrow(new java.io.IOException("synthetic-private@example.invalid"));
        assertThatThrownBy(() -> new BaitlySignatureDownloads(fetcher).fetchSameOrigin(
                "https://sign.example.invalid", "https://sign.example.invalid/doc", new HttpHeaders()))
                .hasMessage("Service de signature temporairement indisponible").hasNoCause();
    }
    @Test void sameOriginDownloadPreservesBytesAndOnlyAuthenticationHeaders() throws Exception {
        var fetcher = mock(com.clenzy.booking.service.PinnedSiteFetcher.class);
        byte[] pdf = "%PDF-synthetic".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        when(fetcher.fetchAuthenticated(anyString(), anyLong(), anyMap()))
                .thenReturn(new com.clenzy.booking.service.PinnedSiteFetcher.FetchedResource("application/pdf", pdf));
        var headers = new HttpHeaders(); headers.set("X-Auth-Token", "synthetic-key"); headers.set("X-Unrelated", "synthetic-other");
        assertThat(new BaitlySignatureDownloads(fetcher).fetchSameOrigin(
                "https://sign.example.invalid", "https://sign.example.invalid/doc", headers)).isEqualTo(pdf);
        verify(fetcher).fetchAuthenticated("https://sign.example.invalid/doc", BaitlySignatureDownloads.MAX_DOCUMENT_BYTES,
                Map.of("X-Auth-Token", "synthetic-key"));
    }
    @ParameterizedTest @ValueSource(strings={"", "<html>Login required</html>", "synthetic-error"})
    void nonPdfDownloadedBodyIsNotASignedDocument(String body) throws Exception {
        var fetcher = mock(com.clenzy.booking.service.PinnedSiteFetcher.class);
        when(fetcher.fetchAuthenticated(anyString(), anyLong(), anyMap()))
                .thenReturn(new com.clenzy.booking.service.PinnedSiteFetcher.FetchedResource("text/html", body.getBytes()));
        assertThatThrownBy(() -> new BaitlySignatureDownloads(fetcher).fetchSameOrigin(
                "https://sign.example.invalid", "https://sign.example.invalid/doc", new HttpHeaders()))
                .isInstanceOf(IllegalStateException.class).hasNoCause();
    }
}
