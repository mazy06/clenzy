package com.clenzy.fiscal.einvoicing.francepdp;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contrat public Iopole v1 : OAuth client_credentials, multipart CII et lectures canoniques. */
@Component
public class BaitlyIopoleApi {
    private final BaitlyIopoleProperties config;
    private final RestTemplate http;
    private final Clock clock;
    private String accessToken;
    private Instant tokenExpiresAt = Instant.EPOCH;

    @Autowired
    public BaitlyIopoleApi(BaitlyIopoleProperties config) {
        this(config, new RestTemplate(requestFactory()), Clock.systemUTC());
    }

    BaitlyIopoleApi(BaitlyIopoleProperties config, RestTemplate http, Clock clock) {
        this.config = config;
        this.http = http;
        this.clock = clock;
    }

    private static JdkClientHttpRequestFactory requestFactory() {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
        var factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(Duration.ofSeconds(20));
        return factory;
    }

    public UUID send(UUID customer, byte[] cii) {
        var fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.APPLICATION_XML);
        var file = new ByteArrayResource(cii) {
            @Override public String getFilename() { return "invoice.xml"; }
        };
        var body = new LinkedMultiValueMap<String, Object>();
        body.add("file", new HttpEntity<>(file, fileHeaders));
        var headers = headers(customer);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        // L'API ne documente pas de clé d'idempotence : aucun rejeu automatique de ce POST.
        var response = http.exchange(config.getEnvironment().api() + "/v1/invoice", HttpMethod.POST,
            new HttpEntity<>(body, headers), JsonNode.class);
        var json = response.getBody();
        if (response.getStatusCode().value() != 201 || json == null || !"INVOICE".equals(json.path("type").asText())) {
            throw new IllegalStateException("Accusé Iopole incomplet");
        }
        return UUID.fromString(json.path("id").asText());
    }

    public JsonNode metadata(UUID customer, UUID invoice) {
        return get(customer, "/v1/invoice/" + invoice);
    }

    public JsonNode unseen(UUID customer) {
        return get(customer, "/v1/invoice/status/notSeen");
    }

    public void acknowledge(UUID customer, UUID status) {
        var response = http.exchange(config.getEnvironment().api() + "/v1/invoice/status/" + status + "/markAsSeen",
            HttpMethod.PUT, new HttpEntity<>(headers(customer)), Void.class);
        if (response.getStatusCode().value() != 204) throw new IllegalStateException("Acquittement Iopole non confirmé");
    }

    private JsonNode get(UUID customer, String path) {
        var response = http.exchange(config.getEnvironment().api() + path, HttpMethod.GET,
            new HttpEntity<>(headers(customer)), JsonNode.class);
        if (response.getStatusCode().value() != 200 || response.getBody() == null) {
            throw new IllegalStateException("Lecture Iopole indisponible");
        }
        return response.getBody();
    }

    private HttpHeaders headers(UUID customer) {
        var headers = new HttpHeaders();
        headers.setBearerAuth(token());
        headers.set("customer-id", customer.toString());
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return headers;
    }

    private synchronized String token() {
        if (!config.ready()) throw new IllegalStateException("Iopole non configuré");
        if (accessToken != null && clock.instant().isBefore(tokenExpiresAt)) return accessToken;
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", config.getClientId());
        form.add("client_secret", config.getClientSecret());
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        var response = http.exchange(config.getEnvironment().tokenUrl(), HttpMethod.POST,
            new HttpEntity<>(form, headers), JsonNode.class);
        var json = response.getBody();
        if (response.getStatusCode().value() != 200 || json == null || !"Bearer".equalsIgnoreCase(json.path("token_type").asText())
                || json.path("access_token").asText().isBlank() || !json.path("expires_in").canConvertToLong()
                || json.path("expires_in").asLong() <= 0) {
            throw new IllegalStateException("Authentification Iopole indisponible");
        }
        accessToken = json.path("access_token").asText();
        tokenExpiresAt = clock.instant().plusSeconds(Math.max(0, Math.min(3600, json.path("expires_in").asLong()) - 30));
        return accessToken;
    }
}
