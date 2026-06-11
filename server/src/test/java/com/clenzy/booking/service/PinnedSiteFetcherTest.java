package com.clenzy.booking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests du fetcher epingle de la preview de site (Z4A-SEC-02 / Z4A-SEC-03).
 * Le parsing HTTP est exerce sans socket via {@code readResponse}.
 */
class PinnedSiteFetcherTest {

    private static ByteArrayInputStream raw(String response) {
        return new ByteArrayInputStream(response.getBytes(StandardCharsets.UTF_8));
    }

    // ─── validatePublicHttpsUrl ───────────────────────────────────────────

    @Test
    @DisplayName("rejects explicit non-443 ports (surface reduction Z4A-SEC-03)")
    void whenCustomPort_thenRejected() {
        assertThatThrownBy(() -> PinnedSiteFetcher.validatePublicHttpsUrl("https://example.com:8443/x"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("443");
    }

    @Test
    @DisplayName("rejects http scheme (delegated to shared validator)")
    void whenHttpScheme_thenRejected() {
        assertThatThrownBy(() -> PinnedSiteFetcher.validatePublicHttpsUrl("http://example.com/"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("rejects private addresses (SSRF)")
    void whenPrivateIp_thenRejected() {
        assertThatThrownBy(() -> PinnedSiteFetcher.validatePublicHttpsUrl("https://10.0.0.1/x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PinnedSiteFetcher.validatePublicHttpsUrl("https://169.254.169.254/meta"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("rejects null/blank URLs")
    void whenBlankUrl_thenRejected() {
        assertThatThrownBy(() -> PinnedSiteFetcher.validatePublicHttpsUrl(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PinnedSiteFetcher.validatePublicHttpsUrl("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── readResponse ─────────────────────────────────────────────────────

    @Test
    @DisplayName("parses content-type and content-length body")
    void whenContentLengthBody_thenParsed() throws IOException {
        String response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: text/html; charset=utf-8\r\n"
                + "Content-Length: 5\r\n"
                + "\r\n"
                + "hello";

        PinnedSiteFetcher.FetchedResource result = PinnedSiteFetcher.readResponse(raw(response), 1024);

        assertThat(result.contentType()).isEqualTo("text/html; charset=utf-8");
        assertThat(new String(result.body(), StandardCharsets.UTF_8)).isEqualTo("hello");
    }

    @Test
    @DisplayName("redirects (3xx) are rejected, never followed (anti SSRF)")
    void whenRedirect_thenRejected() {
        String response = "HTTP/1.1 301 Moved Permanently\r\n"
                + "Location: https://10.0.0.1/internal\r\n"
                + "\r\n";

        assertThatThrownBy(() -> PinnedSiteFetcher.readResponse(raw(response), 1024))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("301");
    }

    @Test
    @DisplayName("body larger than the cap is rejected")
    void whenBodyTooLarge_thenRejected() {
        String response = "HTTP/1.1 200 OK\r\n"
                + "Content-Length: 100\r\n"
                + "\r\n"
                + "x".repeat(100);

        assertThatThrownBy(() -> PinnedSiteFetcher.readResponse(raw(response), 10))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("volumineuse");
    }

    @Test
    @DisplayName("chunked transfer-encoding is decoded")
    void whenChunkedBody_thenDecoded() throws IOException {
        String response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: text/css\r\n"
                + "Transfer-Encoding: chunked\r\n"
                + "\r\n"
                + "5\r\nhello\r\n"
                + "6\r\n world\r\n"
                + "0\r\n\r\n";

        PinnedSiteFetcher.FetchedResource result = PinnedSiteFetcher.readResponse(raw(response), 1024);

        assertThat(result.contentType()).isEqualTo("text/css");
        assertThat(new String(result.body(), StandardCharsets.UTF_8)).isEqualTo("hello world");
    }

    @Test
    @DisplayName("body without content-length is read until EOF")
    void whenNoContentLength_thenReadUntilEof() throws IOException {
        String response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: text/plain\r\n"
                + "\r\n"
                + "streamed";

        PinnedSiteFetcher.FetchedResource result = PinnedSiteFetcher.readResponse(raw(response), 1024);

        assertThat(new String(result.body(), StandardCharsets.UTF_8)).isEqualTo("streamed");
    }

    @Test
    @DisplayName("invalid status line is rejected")
    void whenGarbageStatusLine_thenRejected() {
        assertThatThrownBy(() -> PinnedSiteFetcher.readResponse(raw("not-http\r\n\r\n"), 1024))
                .isInstanceOf(IOException.class);
    }
}
