package com.clenzy.service.signature;

import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;

/** Téléchargement Baitly limité à l'origine configurée, sans transfert de secret par redirection. */
@Component
public class BaitlySignatureDownloads {
    private final RestTemplate http;
    public BaitlySignatureDownloads() {
        var factory = new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(5000); factory.setReadTimeout(15000);
        http = new RestTemplate(factory);
    }

    public byte[] fetchSameOrigin(String base, String target, HttpHeaders headers) {
        try {
            if (target == null || target.length() > 8192) throw BaitlySignatureSafety.invalidResponse();
            URI origin = URI.create(base), uri = URI.create(target);
            if (origin.getHost() == null || origin.getUserInfo() != null || uri.getUserInfo() != null || uri.getFragment() != null
                    || !("https".equalsIgnoreCase(origin.getScheme()) || "http".equalsIgnoreCase(origin.getScheme()))
                    || !origin.getScheme().equalsIgnoreCase(uri.getScheme()) || !origin.getHost().equalsIgnoreCase(uri.getHost())
                    || port(origin) != port(uri)) throw BaitlySignatureSafety.invalidResponse();
            var result = http.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), byte[].class);
            if (!result.getStatusCode().is2xxSuccessful() || result.getBody() == null || result.getBody().length == 0) {
                throw BaitlySignatureSafety.invalidResponse();
            }
            return result.getBody();
        } catch (RuntimeException ignored) { throw BaitlySignatureSafety.unavailable(); }
    }
    private int port(URI uri) {return uri.getPort() >= 0 ? uri.getPort() : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;}
}
