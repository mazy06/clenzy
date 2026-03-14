package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Client HTTP bas-niveau pour l'API Pennylane Entreprise v2.
 *
 * Chaque methode obtient un token valide via PennylaneOAuthService
 * et effectue l'appel HTTP avec circuit breaker.
 */
@Service
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneAccountingClient {

    private static final Logger log = LoggerFactory.getLogger(PennylaneAccountingClient.class);
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
        new ParameterizedTypeReference<>() {};

    private final PennylaneConfig config;
    private final PennylaneOAuthService oauthService;
    private final RestTemplate restTemplate;

    public PennylaneAccountingClient(PennylaneConfig config,
                                      PennylaneOAuthService oauthService) {
        this.config = config;
        this.oauthService = oauthService;
        this.restTemplate = new RestTemplate();
    }

    // ─── Customer Invoices ───────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> createCustomerInvoice(Long orgId, Map<String, Object> body) {
        log.debug("Pennylane API — creation facture client pour org={}", orgId);
        return post(orgId, "/customer_invoices", body);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> listCustomerInvoices(Long orgId, String cursor, int limit) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath("/customer_invoices")
            .queryParam("limit", limit);
        if (cursor != null) builder.queryParam("cursor", cursor);
        return get(orgId, builder.toUriString());
    }

    // ─── Supplier Invoices ───────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> createSupplierInvoice(Long orgId, Map<String, Object> body) {
        log.debug("Pennylane API — creation facture fournisseur pour org={}", orgId);
        return post(orgId, "/supplier_invoices", body);
    }

    // ─── Customers ───────────────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> createCustomer(Long orgId, Map<String, Object> body) {
        log.debug("Pennylane API — creation client pour org={}", orgId);
        return post(orgId, "/customers", body);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallbackOptional")
    public Optional<Map<String, Object>> findCustomerByExternalRef(Long orgId, String externalRef) {
        String filterJson = "[{\"field\":\"external_reference\",\"operator\":\"eq\",\"value\":\"" + externalRef + "\"}]";
        String path = UriComponentsBuilder.fromPath("/customers")
            .queryParam("filter", filterJson)
            .build().toUriString();
        Map<String, Object> response = get(orgId, path);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("customers");
        if (items != null && !items.isEmpty()) {
            return Optional.of(items.get(0));
        }
        return Optional.empty();
    }

    // ─── Suppliers ───────────────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> createSupplier(Long orgId, Map<String, Object> body) {
        log.debug("Pennylane API — creation fournisseur pour org={}", orgId);
        return post(orgId, "/suppliers", body);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallbackOptional")
    public Optional<Map<String, Object>> findSupplierByExternalRef(Long orgId, String externalRef) {
        String filterJson = "[{\"field\":\"external_reference\",\"operator\":\"eq\",\"value\":\"" + externalRef + "\"}]";
        String path = UriComponentsBuilder.fromPath("/suppliers")
            .queryParam("filter", filterJson)
            .build().toUriString();
        Map<String, Object> response = get(orgId, path);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("suppliers");
        if (items != null && !items.isEmpty()) {
            return Optional.of(items.get(0));
        }
        return Optional.empty();
    }

    // ─── Journals ────────────────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> listJournals(Long orgId) {
        return get(orgId, "/journals");
    }

    // ─── HTTP Helpers ────────────────────────────────────────────────────────

    private Map<String, Object> get(Long orgId, String path) {
        String url = config.getAccountingApiBaseUrl() + path;
        HttpHeaders headers = buildHeaders(orgId);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
            url, HttpMethod.GET, new HttpEntity<>(headers), MAP_TYPE);

        return response.getBody();
    }

    private Map<String, Object> post(Long orgId, String path, Map<String, Object> body) {
        String url = config.getAccountingApiBaseUrl() + path;
        HttpHeaders headers = buildHeaders(orgId);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
            url, HttpMethod.POST, new HttpEntity<>(body, headers), MAP_TYPE);

        return response.getBody();
    }

    private HttpHeaders buildHeaders(Long orgId) {
        String token = oauthService.getValidAccessToken(orgId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return headers;
    }

    // ─── Fallbacks ───────────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private Map<String, Object> apiFallback(Long orgId, Map<String, Object> body, Throwable t) {
        log.error("Pennylane accounting API — circuit breaker ouvert: {}", t.getMessage());
        throw new RuntimeException("API Pennylane temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> apiFallback(Long orgId, Throwable t) {
        log.error("Pennylane accounting API — circuit breaker ouvert: {}", t.getMessage());
        throw new RuntimeException("API Pennylane temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> apiFallback(Long orgId, String cursor, int limit, Throwable t) {
        log.error("Pennylane accounting API — circuit breaker ouvert: {}", t.getMessage());
        throw new RuntimeException("API Pennylane temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private Optional<Map<String, Object>> apiFallbackOptional(Long orgId, String ref, Throwable t) {
        log.error("Pennylane accounting API — circuit breaker ouvert: {}", t.getMessage());
        throw new RuntimeException("API Pennylane temporairement indisponible", t);
    }
}
