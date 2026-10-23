package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.Mockito.*;

/** Vrais échanges HTTP en boucle locale uniquement ; aucun secret ni fournisseur réel. */
class BaitlyPennylaneHttpTransportTest {
    Runnable request(String kind, String base) {
        var config = mock(PennylaneConfig.class);
        if (kind.equals("accounting")) {
            when(config.getAccountingApiBaseUrl()).thenReturn(base);
            var oauth = mock(PennylaneOAuthService.class);
            when(oauth.getValidAccessToken(7L)).thenReturn("synthetic-access");
            var client = new PennylaneAccountingClient(config,oauth);
            return () -> client.listJournals(7L);
        }
        when(config.getApiUrl()).thenReturn(base);
        when(config.getClientSecret()).thenReturn("synthetic-access");
        var client = new PennylaneApiService(config);
        return () -> client.getSignatureStatus("123");
    }

    @ParameterizedTest @ValueSource(strings = {"accounting", "signature"})
    void redirectCannotForwardAuthenticatedRequestOrBecomeAValidResponse(String kind) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var redirected = new AtomicInteger();
        var original = new AtomicInteger();
        var authorization = new java.util.concurrent.atomic.AtomicReference<String>();
        server.createContext("/redirect-target", exchange -> {
            redirected.incrementAndGet();
            exchange.sendResponseHeaders(204,-1); exchange.close();
        });
        server.createContext("/", exchange -> {
            original.incrementAndGet();
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            exchange.getResponseHeaders().set("Location","/redirect-target");
            exchange.getResponseHeaders().set("Content-Type","application/json");
            byte[] body = "{\"status\":\"completed\",\"id\":\"123\",\"items\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(302,body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        try {
            assertThatThrownBy(request(kind,"http://127.0.0.1:"+server.getAddress().getPort())::run)
                    .isInstanceOf(IllegalStateException.class).hasNoCause();
            assertThat(original).hasValue(1);
            assertThat(redirected).hasValue(0);
            assertThat(authorization).hasValue("Bearer synthetic-access");
        } finally { server.stop(0); }
    }

    @ParameterizedTest @ValueSource(strings = {"accounting", "signature"})
    void silentProviderHasBoundedReadAndNoAutomaticRetry(String kind) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
            server.setExecutor(workers);
            server.createContext("/", exchange -> {
                calls.incrementAndGet();
                try { release.await(); }
                catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                finally { exchange.close(); }
            });
            server.start();
            try {
                var operation = request(kind,"http://127.0.0.1:"+server.getAddress().getPort());
                assertTimeoutPreemptively(Duration.ofSeconds(25),() ->
                        assertThatThrownBy(operation::run)
                                .isInstanceOf(org.springframework.web.client.ResourceAccessException.class)
                                .hasRootCauseInstanceOf(java.net.SocketTimeoutException.class));
                assertThat(calls).hasValue(1);
            } finally { release.countDown(); server.stop(0); }
        }
    }
}
