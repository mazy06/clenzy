package com.clenzy.integration.pennylane.service;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.HttpURLConnection;

/** Transport Baitly borné, sans suivi de redirection des appels authentifiés. */
final class BaitlyPennylaneHttpTransport {
    private BaitlyPennylaneHttpTransport() {}

    static RestTemplate create() {
        var requests = new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        requests.setConnectTimeout(5000);
        requests.setReadTimeout(15000);
        return new RestTemplate(requests);
    }
}
