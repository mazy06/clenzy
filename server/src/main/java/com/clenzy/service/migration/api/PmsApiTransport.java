package com.clenzy.service.migration.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.ProxySelector;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Outbound calls to a source PMS. Hosts are fixed by each connector (never user supplied), bodies are
 * capped, 429 responses are retried a bounded number of times, and failures surface as controlled codes
 * so that no credential or vendor message reaches logs or API responses.
 */
@Component
public class PmsApiTransport {
    public static final int MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
    private static final int MAX_RETRIES = 3;

    public record Request(String method, URI uri, Map<String, String> headers, String body) {}
    public record Response(int status, byte[] body, String retryAfter) {}

    /** Seam for tests: the default sends through the JVM HTTP client and its configured proxy. */
    @FunctionalInterface
    public interface Exchange { Response send(Request request) throws IOException, InterruptedException; }

    private final ObjectMapper json;
    private final Exchange exchange;
    private final Sleeper sleeper;

    @FunctionalInterface
    public interface Sleeper { void sleep(long millis) throws InterruptedException; }

    @org.springframework.beans.factory.annotation.Autowired
    public PmsApiTransport(ObjectMapper json) {
        this(json, defaultExchange(), Thread::sleep);
    }

    public PmsApiTransport(ObjectMapper json, Exchange exchange, Sleeper sleeper) {
        this.json = json; this.exchange = exchange; this.sleeper = sleeper;
    }

    public JsonNode get(URI uri, Map<String, String> headers) {
        return call(new Request("GET", uri, headers, null));
    }

    public JsonNode postForm(URI uri, Map<String, String> form, Map<String, String> headers) {
        Map<String, String> all = new LinkedHashMap<>(headers);
        all.put("Content-Type", "application/x-www-form-urlencoded");
        String body = form.entrySet().stream()
            .map(e -> encode(e.getKey()) + "=" + encode(e.getValue())).collect(Collectors.joining("&"));
        return call(new Request("POST", uri, all, body));
    }

    public static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }

    private JsonNode call(Request request) {
        for (int attempt = 0; ; attempt++) {
            Response response;
            try { response = exchange.send(request); }
            catch (IOException e) { throw new IllegalArgumentException("API_UNAVAILABLE"); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalArgumentException("API_UNAVAILABLE"); }
            if (response.status() == 429 && attempt < MAX_RETRIES) {
                pause(response.retryAfter(), attempt);
                continue;
            }
            if (response.status() == 401 || response.status() == 403) throw new IllegalArgumentException("API_AUTH");
            if (response.status() == 429) throw new IllegalArgumentException("API_RATE_LIMITED");
            if (response.status() < 200 || response.status() >= 300) throw new IllegalArgumentException("API_UNAVAILABLE");
            if (response.body().length > MAX_RESPONSE_BYTES) throw new IllegalArgumentException("API_RESPONSE_TOO_LARGE");
            try { return json.readTree(response.body()); }
            catch (IOException e) { throw new IllegalArgumentException("API_RESPONSE_UNEXPECTED"); }
        }
    }

    private void pause(String retryAfter, int attempt) {
        long millis = (long) Math.pow(2, attempt) * 1000;
        try { if (retryAfter != null) millis = Math.min(Long.parseLong(retryAfter.trim()) * 1000, 30_000); }
        catch (NumberFormatException ignored) { /* HTTP-date form: keep the exponential delay */ }
        try { sleeper.sleep(millis); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalArgumentException("API_UNAVAILABLE"); }
    }

    private static Exchange defaultExchange() {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER).proxy(ProxySelector.getDefault()).build();
        return request -> {
            var builder = HttpRequest.newBuilder(request.uri()).timeout(Duration.ofSeconds(30));
            request.headers().forEach(builder::header);
            builder.method(request.method(), request.body() == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(request.body()));
            HttpResponse<InputStream> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                byte[] bytes = body.readNBytes(MAX_RESPONSE_BYTES + 1);
                return new Response(response.statusCode(), bytes, response.headers().firstValue("Retry-After").orElse(null));
            }
        };
    }
}
