package com.clenzy.integration.homeaway.controller;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.service.*;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Vrais handlers non implémentés : jamais de faux succès HTTP ou audit métier. */
class BaitlyHomeAwayFailClosedTest {
    final HomeAwayConfig config = mock(HomeAwayConfig.class);
    final HomeAwayConnectionQueryService query = mock(HomeAwayConnectionQueryService.class);
    final HomeAwayConnectionRepository connections = mock(HomeAwayConnectionRepository.class);
    final HomeAwayApiClient api = mock(HomeAwayApiClient.class);
    final HomeAwayOAuthService oauth = mock(HomeAwayOAuthService.class);
    final AuditLogService audit = mock(AuditLogService.class);
    final HomeAwayWebhookController controller = new HomeAwayWebhookController(config, query,
            new HomeAwaySyncService(connections, api, oauth, audit));

    String sign(String body) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("synthetic-fixture-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }

    @ParameterizedTest @ValueSource(strings={"reservation.created", "reservation.updated", "reservation.cancelled", "availability.updated"})
    void realUnsupportedHandlersReturn503AndNeverAuditSuccess(String action) throws Exception {
        when(config.getWebhookSecret()).thenReturn("synthetic-fixture-secret");
        when(query.resolveOrganizationId("synthetic-listing")).thenReturn(7L);
        String body = "{\"event_type\":\"" + action + "\",\"data\":{\"listing_id\":\"synthetic-listing\",\"guest_email\":\"synthetic-private@example.invalid\"}}";
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(HomeAwayWebhookController.class);
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        logs.start();logger.addAppender(logs);
        try {
            var result = MockMvcBuilders.standaloneSetup(controller).build().perform(post("/api/webhooks/homeaway")
                    .contentType(MediaType.APPLICATION_JSON).header("X-HomeAway-Signature", sign(body)).content(body))
                    .andExpect(status().isServiceUnavailable()).andReturn();
            assertThat(result.getResponse().getContentAsString()).doesNotContain("synthetic-private", "guest_email", "will retry", "Event received");
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("synthetic-private", "guest_email");
                assertThat(event.getThrowableProxy()).isNull();
            });
            verifyNoInteractions(connections, api, oauth, audit);
        } finally {logger.detachAppender(logs);logs.stop();}
    }

    @ParameterizedTest @ValueSource(strings={"[]", "null", "{\"event_type\":1,\"data\":{}}", "{\"event_type\":\"reservation.created\",\"data\":[]}", "not-json"})
    void malformedSignedInputReturns400WithoutLookup(String body) throws Exception {
        when(config.getWebhookSecret()).thenReturn("synthetic-fixture-secret");
        MockMvcBuilders.standaloneSetup(controller).build().perform(post("/api/webhooks/homeaway")
                .contentType(MediaType.APPLICATION_JSON).header("X-HomeAway-Signature", sign(body)).content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(query, audit, api);
    }

    @ParameterizedTest @ValueSource(strings={"INACTIVE", "EXPIRED", "ERROR"})
    void inactiveConnectionCannotReceiveSignedBusinessEvents(String state) throws Exception {
        when(config.getWebhookSecret()).thenReturn("synthetic-fixture-secret");
        var connection = new com.clenzy.integration.homeaway.model.HomeAwayConnection();
        connection.setOrganizationId(7L); connection.setStatus(com.clenzy.integration.homeaway.model.HomeAwayConnection.HomeAwayConnectionStatus.valueOf(state));
        when(connections.findByListingId("synthetic-listing")).thenReturn(java.util.Optional.of(connection));
        var actualQuery = new HomeAwayConnectionQueryService(connections);
        var service = mock(HomeAwaySyncService.class);
        var endpoint = new HomeAwayWebhookController(config, actualQuery, service);
        String body = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"synthetic-listing\"}}";
        MockMvcBuilders.standaloneSetup(endpoint).build().perform(post("/api/webhooks/homeaway")
                .contentType(MediaType.APPLICATION_JSON).header("X-HomeAway-Signature", sign(body)).content(body))
                .andExpect(status().isServiceUnavailable());
        verifyNoInteractions(service);
    }

    @org.junit.jupiter.api.Test void oversizedSignedPayloadIsNotParsedOrRouted() throws Exception {
        when(config.getWebhookSecret()).thenReturn("synthetic-fixture-secret");
        String body = "x".repeat(1_048_577);
        MockMvcBuilders.standaloneSetup(controller).build().perform(post("/api/webhooks/homeaway")
                .contentType(MediaType.APPLICATION_JSON).header("X-HomeAway-Signature", sign(body)).content(body))
                .andExpect(status().isPayloadTooLarge());
        verifyNoInteractions(query, audit, api);
    }
}
