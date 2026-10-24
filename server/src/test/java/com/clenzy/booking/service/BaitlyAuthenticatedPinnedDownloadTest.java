package com.clenzy.booking.service;

import com.clenzy.service.ICalUrlValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vrai parsing et écriture HTTP ; socket et résolution DNS simulés, aucun réseau. */
class BaitlyAuthenticatedPinnedDownloadTest {
    @Test void authenticatedRequestUsesTheValidatedAddressExactlyOnce() throws Exception {
        String url = "https://signature.example.invalid/document?ref=synthetic";
        InetAddress pinned = InetAddress.getByAddress(new byte[]{9,9,9,9});
        var fetcher = spy(new PinnedSiteFetcher());
        var socket = mock(Socket.class); var output = new ByteArrayOutputStream();
        when(socket.getOutputStream()).thenReturn(output);
        when(socket.getInputStream()).thenReturn(raw("HTTP/1.1 200 OK\r\nContent-Length: 6\r\n\r\n%PDF-x"));
        doReturn(socket).when(fetcher).openPinnedTlsSocket(URI.create(url), pinned);
        try (var dns = mockStatic(ICalUrlValidator.class)) {
            dns.when(() -> ICalUrlValidator.validateAndResolve(url)).thenReturn(pinned);
            assertThat(fetcher.fetchAuthenticated(url, 1024, Map.of("Authorization", "Bearer synthetic-key")).body())
                    .isEqualTo("%PDF-x".getBytes(StandardCharsets.UTF_8));
            dns.verify(() -> ICalUrlValidator.validateAndResolve(url), times(1));
        }
        verify(fetcher).openPinnedTlsSocket(URI.create(url), pinned);
        verify(socket).close();
        assertThat(output.toString(StandardCharsets.US_ASCII))
                .contains("GET /document?ref=synthetic HTTP/1.1\r\n", "Host: signature.example.invalid\r\n", "Authorization: Bearer synthetic-key\r\n");
    }
    @ParameterizedTest @ValueSource(strings={"Host", "Cookie", "Proxy-Authorization", "X-Arbitrary"})
    void unrelatedHeadersAreRefusedBeforeDns(String name) {
        try (var dns = mockStatic(ICalUrlValidator.class)) {
            assertThatThrownBy(() -> new PinnedSiteFetcher().fetchAuthenticated(
                    "https://signature.example.invalid/doc", 1024, Map.of(name, "synthetic"))).isInstanceOf(IllegalArgumentException.class);
            dns.verifyNoInteractions();
        }
    }
    @ParameterizedTest @ValueSource(strings={"synthetic\r\nHost: localhost", "synthetic\nother", "synthetic\u0000value"})
    void injectedHeaderValuesAreRefusedBeforeDns(String value) {
        try (var dns = mockStatic(ICalUrlValidator.class)) {
            assertThatThrownBy(() -> new PinnedSiteFetcher().fetchAuthenticated(
                    "https://signature.example.invalid/doc", 1024, Map.of("X-Auth-Token", value))).isInstanceOf(IllegalArgumentException.class);
            dns.verifyNoInteractions();
        }
    }
    @ParameterizedTest @ValueSource(ints={301,302,307,308,401,500})
    void nonSuccessNeverReturnsTheBodyOrFollowsRedirects(int status) {
        assertThatThrownBy(() -> PinnedSiteFetcher.readResponse(raw("HTTP/1.1 " + status
                + " Error\r\nLocation: https://127.0.0.1/private\r\nContent-Length: 6\r\n\r\n%PDF-x"),1024))
                .isInstanceOf(IOException.class);
    }
    @Test void truncatedDocumentIsRejected() {
        assertThatThrownBy(() -> PinnedSiteFetcher.readResponse(raw("HTTP/1.1 200 OK\r\nContent-Length: 20\r\n\r\n%PDF-x"),1024))
                .isInstanceOf(IOException.class).hasMessage("Corps HTTP tronqué");
    }
    static InputStream raw(String value) {return new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8));}
}
