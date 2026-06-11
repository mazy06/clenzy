package com.clenzy.service.ical;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests de {@link ICalFeedDownloader} : pinning de la connexion sur l'IP validee
 * (anti DNS-rebinding), rejet des redirections (redirection vers IP privee jamais
 * suivie), decodage HTTP/1.1 (chunked, content-length) et limite de taille.
 * Aucun acces reseau : la socket est court-circuitee.
 */
@DisplayName("ICalFeedDownloader — pinned TLS download")
class ICalFeedDownloaderTest {

    private static final String ICS_BODY = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";

    /** Socket factice pre-chargee avec une reponse HTTP brute. */
    private static final class FakeSocket extends Socket {
        private final ByteArrayInputStream in;
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();
        boolean closed = false;

        FakeSocket(String rawResponse) {
            this.in = new ByteArrayInputStream(rawResponse.getBytes(StandardCharsets.ISO_8859_1));
        }

        @Override
        public InputStream getInputStream() {
            return in;
        }

        @Override
        public OutputStream getOutputStream() {
            return out;
        }

        @Override
        public synchronized void close() {
            closed = true;
        }

        String writtenRequest() {
            return out.toString(StandardCharsets.ISO_8859_1);
        }
    }

    /** Downloader qui capture l'adresse epinglee et court-circuite le reseau. */
    private static final class CapturingDownloader extends ICalFeedDownloader {
        final FakeSocket socket;
        InetAddress capturedPinnedAddress;
        int connectionCount = 0;

        CapturingDownloader(String rawResponse) {
            this.socket = new FakeSocket(rawResponse);
        }

        @Override
        Socket openPinnedTlsSocket(URI uri, InetAddress pinnedAddress) {
            this.capturedPinnedAddress = pinnedAddress;
            this.connectionCount++;
            return socket;
        }
    }

    @Test
    @DisplayName("la connexion utilise l'InetAddress validee par le validateur (pinning anti DNS-rebinding)")
    void whenDownloading_thenConnectionUsesValidatedAddress() throws Exception {
        // Arrange — IP publique litterale : validateAndResolve la retourne sans lookup DNS
        CapturingDownloader downloader = new CapturingDownloader(
                "HTTP/1.1 200 OK\r\nContent-Length: " + ICS_BODY.length() + "\r\n\r\n" + ICS_BODY);

        // Act
        InputStream body = downloader.download("https://93.184.216.34/cal.ics?s=secret");

        // Assert — la connexion est ouverte sur l'adresse validee, pas re-resolue
        assertThat(downloader.capturedPinnedAddress).isNotNull();
        assertThat(downloader.capturedPinnedAddress.getHostAddress()).isEqualTo("93.184.216.34");
        assertThat(new String(body.readAllBytes(), StandardCharsets.UTF_8)).isEqualTo(ICS_BODY);
        String request = downloader.socket.writtenRequest();
        assertThat(request).startsWith("GET /cal.ics?s=secret HTTP/1.1");
        assertThat(request).contains("Host: 93.184.216.34");
        assertThat(request).contains("Connection: close");
    }

    @Test
    @DisplayName("redirection 302 vers une IP privee → rejet sans suivre la redirection")
    void whenServerRedirectsToPrivateIp_thenRejectedWithoutFollowing() {
        // Arrange
        CapturingDownloader downloader = new CapturingDownloader(
                "HTTP/1.1 302 Found\r\nLocation: https://192.168.1.1/internal.ics\r\nContent-Length: 0\r\n\r\n");

        // Act & Assert — toute reponse non-200 est rejetee (Redirect.NEVER conserve)
        assertThatThrownBy(() -> downloader.download("https://93.184.216.34/cal.ics"))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("302");

        // Une seule connexion ouverte : la cible privee n'est jamais contactee
        assertThat(downloader.connectionCount).isEqualTo(1);
        assertThat(downloader.socket.closed).isTrue();
    }

    @Test
    @DisplayName("URL pointant vers une IP privee → rejet AVANT toute connexion")
    void whenUrlTargetsPrivateIp_thenRejectedBeforeConnecting() {
        CapturingDownloader downloader = new CapturingDownloader("");

        assertThatThrownBy(() -> downloader.download("https://192.168.1.10/cal.ics"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(downloader.connectionCount).isZero();
    }

    @Test
    @DisplayName("corps Transfer-Encoding: chunked decode correctement")
    void whenResponseIsChunked_thenBodyIsDecoded() throws Exception {
        String chunked = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n"
                + "5\r\nBEGIN\r\n4\r\n:VCA\r\n0\r\n\r\n";
        CapturingDownloader downloader = new CapturingDownloader(chunked);

        InputStream body = downloader.download("https://93.184.216.34/cal.ics");

        assertThat(new String(body.readAllBytes(), StandardCharsets.UTF_8)).isEqualTo("BEGIN:VCA");
    }

    @Test
    @DisplayName("statut 500 → IOException avec le code")
    void whenServerReturns500_thenIOExceptionWithCode() {
        CapturingDownloader downloader = new CapturingDownloader(
                "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n");

        assertThatThrownBy(() -> downloader.download("https://93.184.216.34/cal.ics"))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("500");
    }

    @Test
    @DisplayName("reponse sans Content-Length ni chunked → lecture jusqu'a EOF")
    void whenResponseHasNoLengthHeaders_thenReadsUntilEof() throws Exception {
        CapturingDownloader downloader = new CapturingDownloader(
                "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n" + ICS_BODY);

        InputStream body = downloader.download("https://93.184.216.34/cal.ics");

        assertThat(new String(body.readAllBytes(), StandardCharsets.UTF_8)).isEqualTo(ICS_BODY);
    }
}
