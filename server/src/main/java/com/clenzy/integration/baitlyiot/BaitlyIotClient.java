package com.clenzy.integration.baitlyiot;

import com.clenzy.dto.noise.NoiseDataPointDto;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.RequestEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.DeserializationFeature;

/** Server-only access to Baitly IoT. The PMS derives the organization from its own resource. */
@Component
public class BaitlyIotClient {
    private final RestTemplate http;
    private final String baseUrl;
    private final String serviceToken;
    private final String ingestionUrl;
    private final boolean simulatorsEnabled;
    private final Clock clock;
    // Bounds the PMS threads an unavailable IoT service can hold; a short wait absorbs polling bursts.
    private final java.util.concurrent.Semaphore requests;

    public BaitlyIotClient(@Value("${baitly.iot.base-url:}") String baseUrl,
                          @Value("${baitly.iot.service-token:}") String serviceToken,
                          @Value("${baitly.iot.ingestion-url:}") String ingestionUrl,
                          @Value("${baitly.iot.simulators-enabled:false}") boolean simulatorsEnabled,
                          @Value("${baitly.iot.max-concurrent-requests:16}") int maxConcurrentRequests,
                          Clock clock) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.serviceToken = serviceToken;
        this.ingestionUrl = ingestionUrl.replaceAll("/+$", "");
        this.simulatorsEnabled = simulatorsEnabled;
        this.clock = clock;
        if (maxConcurrentRequests < 1 || maxConcurrentRequests > 256) {
            throw new IllegalArgumentException("baitly.iot.max-concurrent-requests doit etre compris entre 1 et 256");
        }
        this.requests = new java.util.concurrent.Semaphore(maxConcurrentRequests);
        if (!this.ingestionUrl.isBlank()) {
            validateUrl(this.ingestionUrl);
        }
        if (!baseUrl.isBlank()) {
            validateConfiguration(baseUrl, serviceToken);
        }
        var transport = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
                .followRedirects(HttpClient.Redirect.NEVER).build();
        var factory = new JdkClientHttpRequestFactory(transport);
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.http = new RestTemplate(factory);
        // IoT has one wire format. Do not activate XML or other converters from the PMS classpath.
        this.http.setMessageConverters(this.http.getMessageConverters().stream()
                .filter(MappingJackson2HttpMessageConverter.class::isInstance).toList());
        this.http.getInterceptors().add((request, body, execution) -> {
            boolean acquired;
            try { acquired = requests.tryAcquire(1, java.util.concurrent.TimeUnit.SECONDS); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); acquired = false; }
            if (!acquired) throw new org.springframework.web.client.RestClientException("Service Baitly IoT occupe");
            try {
                return new BoundedIotResponse(execution.execute(request, body), requests::release);
            } catch (java.io.IOException | RuntimeException error) {
                requests.release();
                throw error;
            }
        });
        this.http.setErrorHandler(new org.springframework.web.client.ResponseErrorHandler() {
            @Override public boolean hasError(org.springframework.http.client.ClientHttpResponse response) throws java.io.IOException {
                return !response.getStatusCode().is2xxSuccessful();
            }
            @Override public void handleError(org.springframework.http.client.ClientHttpResponse response) throws java.io.IOException {
                // Never relay an upstream body: a compromised IoT service could echo machine credentials.
                throw new org.springframework.web.client.RestClientException(
                        "Service Baitly IoT indisponible (" + response.getStatusCode().value() + ")");
            }
        });
        this.http.getMessageConverters().stream().filter(MappingJackson2HttpMessageConverter.class::isInstance)
                .map(MappingJackson2HttpMessageConverter.class::cast).forEach(converter -> {
                    var mapper = converter.getObjectMapper();
                    mapper.enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
                    mapper.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
                    mapper.getFactory().setStreamReadConstraints(StreamReadConstraints.builder()
                            .maxNestingDepth(8).maxStringLength(256).maxNumberLength(32).build());
                });
    }

    public record Device(UUID id, long organizationId, long propertyId, String name, boolean revoked,
                         int reportingIntervalSeconds, Instant lastReceivedAt, Instant lastMeasuredAt, boolean online, boolean simulation,
                         String mqttIdentity) {}
    public record MqttIdentity(String mqttIdentity) {}
    public record Registration(long propertyId, String name, int reportingIntervalSeconds) {}
    public record Credentials(Device device, String token) {
        @Override public String toString() { return "Baitly IoT credentials [redacted]"; }
    }
    public record Sample(UUID eventId, Instant measuredAt, int windowSeconds, double laeqDbA) {}
    public record IngestionResult(UUID eventId, boolean duplicate) {}
    public record Measurement(UUID eventId, Instant measuredAt, Instant receivedAt, int windowSeconds, double laeqDbA) {}

    public Device getDevice(String id, long orgId) {
        return get(deviceUrl(id, orgId).build().toUri(), Device.class);
    }

    public Device requireProperty(String id, long orgId, long propertyId) {
        Device device = getDevice(id, orgId);
        if (device == null || device.organizationId() != orgId || device.propertyId() != propertyId || device.revoked()) {
            throw new IllegalArgumentException("Capteur Baitly absent, revoque ou rattache a un autre logement");
        }
        return device;
    }

    public boolean configured() { return !baseUrl.isBlank(); }

    /** Synthetic devices are a test tool: off unless the environment explicitly enables them. */
    public boolean simulatorsEnabled() { return simulatorsEnabled; }

    /** Public HTTPS ingestion URL shown to the person configuring a device; empty when not published. */
    public String ingestionUrl() { return ingestionUrl; }

    public Device ensurePhysical(UUID id, long orgId, Registration input) {
        URI uri = organizationUrl(orgId).path("/physical/").path(id.toString()).build().toUri();
        return http.exchange(RequestEntity.put(uri).header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken)
                .body(input), Device.class).getBody();
    }

    public MqttIdentity rotateMqttIdentity(String id, long orgId) {
        return http.exchange(RequestEntity.post(deviceUrl(id, orgId).path("/mqtt-identity").build().toUri())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken).build(), MqttIdentity.class).getBody();
    }

    /** Revokes, hides, then lets the IoT retention job delete the device and its history. Idempotent. */
    public void requestErasure(String id, long orgId) {
        http.exchange(RequestEntity.post(deviceUrl(id, orgId).path("/erasure").build().toUri())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken).build(), Void.class);
    }

    public Device ensureSimulator(UUID id, long orgId, Registration input) {
        URI uri = organizationUrl(orgId).path("/simulators/").path(id.toString()).build().toUri();
        return http.exchange(RequestEntity.put(uri).header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken)
                .body(input), Device.class).getBody();
    }

    public Credentials rotate(String id, long orgId) {
        return http.exchange(RequestEntity.post(deviceUrl(id, orgId).path("/credentials").build().toUri())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken).build(), Credentials.class).getBody();
    }

    public IngestionResult simulate(String id, long orgId, Sample sample) {
        return http.exchange(RequestEntity.post(deviceUrl(id, orgId).path("/simulate").build().toUri())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken).body(sample), IngestionResult.class).getBody();
    }

    public void revoke(String id, long orgId) {
        http.exchange(RequestEntity.delete(deviceUrl(id, orgId).build().toUri())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken).build(), Void.class);
    }

    public List<NoiseDataPointDto> noise(String id, long orgId, long propertyId, String from, String to, String label) {
        Instant end = to == null ? clock.instant() : parse(to);
        Instant start = from == null ? end.minus(Duration.ofHours(24)) : parse(from);
        if (!start.isBefore(end) || Duration.between(start, end).compareTo(Duration.ofDays(7)) > 0) {
            throw new IllegalArgumentException("Periode invalide : sept jours maximum, debut avant la fin");
        }
        // IoT checks the property link in the same call: one request instead of two per refresh.
        URI uri = deviceUrl(id, orgId).path("/measurements").queryParam("from", start)
                .queryParam("to", end).queryParam("limit", 10000).queryParam("propertyId", propertyId)
                .build().encode().toUri();
        Measurement[] values = get(uri, Measurement[].class);
        if (values == null) {
            throw new IllegalStateException("Reponse Baitly IoT vide");
        }
        if (values.length > 10000 || Arrays.stream(values).anyMatch(value -> value == null || value.eventId() == null
                || value.measuredAt() == null || value.receivedAt() == null
                || value.measuredAt().isBefore(start) || !value.measuredAt().isBefore(end)
                || value.windowSeconds() < 1 || value.windowSeconds() > 300
                || !Double.isFinite(value.laeqDbA()) || value.laeqDbA() < 0 || value.laeqDbA() > 150)) {
            throw new IllegalStateException("Reponse Baitly IoT invalide");
        }
        return Arrays.stream(values)
                .map(value -> new NoiseDataPointDto(value.measuredAt().toString(), value.laeqDbA(), label)).toList();
    }

    private UriComponentsBuilder deviceUrl(String id, long orgId) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("Identifiant du capteur Baitly requis");
        }
        return organizationUrl(orgId).path("/").path(UUID.fromString(id).toString());
    }

    private UriComponentsBuilder organizationUrl(long orgId) {
        if (baseUrl.isBlank()) {
            throw new IllegalStateException("Baitly IoT n'est pas configure");
        }
        return UriComponentsBuilder.fromUriString(baseUrl).path("/internal/v1/organizations/")
                .path(Long.toString(orgId)).path("/devices");
    }

    private <T> T get(URI uri, Class<T> type) {
        return http.exchange(RequestEntity.get(uri)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken).build(), type).getBody();
    }

    private static Instant parse(String value) {
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException invalid) {
            throw new IllegalArgumentException("Date invalide : format ISO 8601 UTC attendu");
        }
    }

    private static void validateUrl(String value) {
        URI uri = URI.create(value);
        boolean loopback = List.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost());
        if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()) && loopback)) {
            throw new IllegalArgumentException("Configuration Baitly IoT invalide : URL d'ingestion HTTPS requise");
        }
    }

    private static void validateConfiguration(String baseUrl, String token) {
        URI uri = URI.create(baseUrl);
        boolean loopback = List.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost());
        if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()) && loopback)
                || !token.matches("[\\x21-\\x7E]{32,128}")) {
            throw new IllegalArgumentException("Configuration Baitly IoT invalide : HTTPS et secret service requis");
        }
    }
}
