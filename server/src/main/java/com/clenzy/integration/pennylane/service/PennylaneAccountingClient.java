package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.oauth.BaitlyOAuthBusyException;
import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
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
        this.restTemplate = BaitlyPennylaneHttpTransport.create();
    }

    // ─── Customer Invoices ───────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> createCustomerInvoice(Long orgId, Map<String, Object> body) {
        log.debug("Pennylane API — creation facture client pour org={}", orgId);
        return post(orgId, "/customer_invoices", body);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> listCustomerInvoices(Long orgId, String cursor, int limit) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(config.getAccountingApiBaseUrl() + "/customer_invoices")
            .queryParam("limit", limit);
        if (cursor != null) builder.queryParam("cursor", "{cursor}");
        return get(orgId, builder, cursor == null ? Map.of() : Map.of("cursor", cursor));
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
        var builder = UriComponentsBuilder.fromUriString(config.getAccountingApiBaseUrl() + "/customers")
            .queryParam("filter", "{filter}").queryParam("limit", 2);
        Map<String, Object> response = get(orgId, builder, Map.of("filter", externalReferenceFilter(externalRef)));

        return exactParty(response, externalRef);
    }

    // ─── Suppliers ───────────────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> createSupplier(Long orgId, Map<String, Object> body) {
        log.debug("Pennylane API — creation fournisseur pour org={}", orgId);
        return post(orgId, "/suppliers", body);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallbackOptional")
    public Optional<Map<String, Object>> findSupplierByExternalRef(Long orgId, String externalRef) {
        var builder = UriComponentsBuilder.fromUriString(config.getAccountingApiBaseUrl() + "/suppliers")
            .queryParam("filter", "{filter}").queryParam("limit", 2);
        Map<String, Object> response = get(orgId, builder, Map.of("filter", externalReferenceFilter(externalRef)));

        return exactParty(response, externalRef);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallbackOptional")
    public Optional<Map<String, Object>> findCustomerInvoiceByExternalRef(Long orgId, String reference) {
        return findInvoice(orgId, "/customer_invoices", reference);
    }

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallbackOptional")
    public Optional<Map<String, Object>> findSupplierInvoiceByExternalRef(Long orgId, String reference) {
        return findInvoice(orgId, "/supplier_invoices", reference);
    }

    private Optional<Map<String, Object>> findInvoice(Long orgId, String path, String reference) {
        var builder = UriComponentsBuilder.fromUriString(config.getAccountingApiBaseUrl() + path)
                .queryParam("filter", "{filter}").queryParam("limit", 2);
        return exactParty(get(orgId, builder, Map.of("filter", externalReferenceFilter(reference))), reference);
    }

    /** API v2 : seule une page terminale complète et non ambiguë prouve une absence. */
    private Optional<Map<String, Object>> exactParty(Map<String, Object> response, String reference) {
        if (response == null || response.containsKey("error") || !Boolean.FALSE.equals(response.get("has_more"))
                || !response.containsKey("next_cursor") || response.get("next_cursor") != null
                || !(response.get("items") instanceof List<?> items) || items.size() > 1) {
            throw invalidLookup();
        }
        if (items.isEmpty()) return Optional.empty();
        if (!(items.get(0) instanceof Map<?, ?> item) || !reference.equals(item.get("external_reference"))
                || !(item.get("id") instanceof Number number)) {
            throw invalidLookup();
        }
        try {
            com.clenzy.util.BaitlyExternalIds.require(number, 50);
        } catch (IllegalArgumentException ignored) {
            throw invalidLookup();
        }
        var result = new java.util.LinkedHashMap<String, Object>();
        item.forEach((key, value) -> { if (key instanceof String text) result.put(text, value); });
        return Optional.of(result);
    }
    private BaitlyPennylaneDiagnostics.Failure invalidLookup() {
        return BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.INVALID_RESPONSE);
    }

    // ─── Journals ────────────────────────────────────────────────────────────

    @CircuitBreaker(name = "pennylane-accounting", fallbackMethod = "apiFallback")
    public Map<String, Object> listJournals(Long orgId) {
        return get(orgId, "/journals");
    }

    // ─── HTTP Helpers ────────────────────────────────────────────────────────

    private Map<String, Object> get(Long orgId, String path) {
        return get(orgId, UriComponentsBuilder.fromUriString(config.getAccountingApiBaseUrl() + path), Map.of());
    }

    private Map<String, Object> get(Long orgId, UriComponentsBuilder builder, Map<String, ?> variables) {
        HttpHeaders headers = buildHeaders(orgId);
        // Encodage strict des valeurs une seule fois ; RestTemplate reçoit une URI, pas un template JSON.
        var uri = builder.encode().buildAndExpand(variables).toUri();
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
            uri, HttpMethod.GET, new HttpEntity<>(headers), MAP_TYPE);

        if (!response.getStatusCode().is2xxSuccessful()) throw invalidLookup();
        return response.getBody();
    }

    private String externalReferenceFilter(String reference) {
        if (reference == null) throw new IllegalArgumentException("Référence externe Pennylane requise");
        var filter = JsonNodeFactory.instance.arrayNode();
        filter.addObject().put("field", "external_reference").put("operator", "eq").put("value", reference);
        return filter.toString();
    }

    private Map<String, Object> post(Long orgId, String path, Map<String, Object> body) {
        String url = config.getAccountingApiBaseUrl() + path;
        HttpHeaders headers = buildHeaders(orgId);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
            url, HttpMethod.POST, new HttpEntity<>(body, headers), MAP_TYPE);

        if (!response.getStatusCode().is2xxSuccessful()) throw invalidLookup();
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
        throw protectedFailure(t);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> apiFallback(Long orgId, Throwable t) {
        throw protectedFailure(t);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> apiFallback(Long orgId, String cursor, int limit, Throwable t) {
        throw protectedFailure(t);
    }

    @SuppressWarnings("unused")
    private Optional<Map<String, Object>> apiFallbackOptional(Long orgId, String ref, Throwable t) {
        throw protectedFailure(t);
    }

    private RuntimeException protectedFailure(Throwable failure) {
        if (failure instanceof BaitlyOAuthBusyException busy) return busy;
        if (failure instanceof BaitlyPennylaneDiagnostics.Failure) {
            return BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.reason(failure));
        }
        log.error("Pennylane : appel comptable indisponible");
        return BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.UNAVAILABLE);
    }
}
