package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PennylaneAccountingClientTest {

    @Mock private PennylaneConfig config;
    @Mock private PennylaneOAuthService oauthService;
    @Mock private RestTemplate restTemplate;

    private PennylaneAccountingClient client;

    private static final Long ORG_ID = 7L;
    private static final String BASE_URL = "https://app.pennylane.com/api/external/v2";

    @BeforeEach
    void setUp() {
        client = new PennylaneAccountingClient(config, oauthService);
        ReflectionTestUtils.setField(client, "restTemplate", restTemplate);
        when(config.getAccountingApiBaseUrl()).thenReturn(BASE_URL);
        when(oauthService.getValidAccessToken(ORG_ID)).thenReturn("bearer-token");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void mockSuccessfulExchange(Map<String, Object> body) {
        when(restTemplate.exchange(any(URI.class), any(HttpMethod.class), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
            .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class),
                any(ParameterizedTypeReference.class)))
            .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));
    }

    // ===================================================================
    // createCustomerInvoice
    // ===================================================================

    @Nested
    @DisplayName("createCustomerInvoice")
    class CreateCustomerInvoice {

        @Test
        @DisplayName("posts to /customer_invoices and returns body")
        void posts_returnsBody() {
            Map<String, Object> response = Map.of("id", 1L);
            mockSuccessfulExchange(response);

            Map<String, Object> result = client.createCustomerInvoice(ORG_ID, Map.of("amount", 100));

            assertThat(result).isEqualTo(response);
            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue().toString()).isEqualTo(BASE_URL + "/customer_invoices");
        }

        @Test
        @DisplayName("includes bearer token in request headers")
        void includesBearerToken() {
            mockSuccessfulExchange(Map.of());

            client.createCustomerInvoice(ORG_ID, Map.of());

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor = entityCaptor();
            verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), captor.capture(),
                any(ParameterizedTypeReference.class));
            assertThat(captor.getValue().getHeaders().getFirst("Authorization"))
                .isEqualTo("Bearer bearer-token");
        }
    }

    // ===================================================================
    // listCustomerInvoices
    // ===================================================================

    @Nested
    @DisplayName("listCustomerInvoices")
    class ListCustomerInvoices {

        @Test
        @DisplayName("GETs with limit when cursor is null")
        void noCursor_includesLimit() {
            mockSuccessfulExchange(Map.of("customer_invoices", List.of()));

            client.listCustomerInvoices(ORG_ID, null, 50);

            ArgumentCaptor<URI> urlCaptor = ArgumentCaptor.forClass(URI.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue().toString()).contains("limit=50");
            assertThat(urlCaptor.getValue().toString()).doesNotContain("cursor=");
        }

        @Test
        @DisplayName("GETs with cursor and limit when both present")
        void withCursor_includesCursor() {
            mockSuccessfulExchange(Map.of());

            client.listCustomerInvoices(ORG_ID, "next-page", 25);

            ArgumentCaptor<URI> urlCaptor = ArgumentCaptor.forClass(URI.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue().toString()).contains("cursor=next-page");
            assertThat(urlCaptor.getValue().toString()).contains("limit=25");
        }
    }

    // ===================================================================
    // createSupplierInvoice
    // ===================================================================

    @Test
    @DisplayName("createSupplierInvoice posts to /supplier_invoices")
    void createSupplierInvoice_posts() {
        mockSuccessfulExchange(Map.of("id", 5L));

        Map<String, Object> result = client.createSupplierInvoice(ORG_ID, Map.of("amount", 200));

        assertThat(result).containsEntry("id", 5L);
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST),
            any(HttpEntity.class), any(ParameterizedTypeReference.class));
        assertThat(urlCaptor.getValue().toString()).endsWith("/supplier_invoices");
    }

    // ===================================================================
    // createCustomer
    // ===================================================================

    @Test
    @DisplayName("createCustomer posts to /customers")
    void createCustomer_posts() {
        mockSuccessfulExchange(Map.of("id", 9L));

        Map<String, Object> result = client.createCustomer(ORG_ID, Map.of("name", "X"));

        assertThat(result).containsEntry("id", 9L);
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST),
            any(HttpEntity.class), any(ParameterizedTypeReference.class));
        assertThat(urlCaptor.getValue().toString()).endsWith("/customers");
    }

    // ===================================================================
    // findCustomerByExternalRef
    // ===================================================================

    @Nested
    @DisplayName("findCustomerByExternalRef")
    class FindCustomerByExternalRef {

        @Test
        @DisplayName("returns Optional.empty when no customers")
        void noResults_empty() {
            mockSuccessfulExchange(page(List.of()));

            Optional<Map<String, Object>> result = client.findCustomerByExternalRef(ORG_ID, "ref-123");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns first customer when present")
        void found_returnsFirst() {
            Map<String, Object> customer = Map.of("id", 1L, "name", "Alice", "external_reference", "ref-123");
            mockSuccessfulExchange(page(List.of(customer)));

            Optional<Map<String, Object>> result = client.findCustomerByExternalRef(ORG_ID, "ref-123");

            assertThat(result).isPresent().get().isEqualTo(customer);
        }

        @Test
        @DisplayName("rejects malformed response when 'customers' key missing")
        void missingKey_empty() {
            mockSuccessfulExchange(Map.of());

            org.assertj.core.api.Assertions.assertThatThrownBy(() -> client.findCustomerByExternalRef(ORG_ID, "ref")).isInstanceOf(BaitlyPennylaneDiagnostics.Failure.class);
        }

        @Test
        @DisplayName("URL includes the filter parameter with external_reference")
        void buildsFilterUrl() {
            mockSuccessfulExchange(page(List.of()));

            client.findCustomerByExternalRef(ORG_ID, "ext-42");

            ArgumentCaptor<URI> urlCaptor = ArgumentCaptor.forClass(URI.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue().toString()).contains("/customers");
            assertThat(urlCaptor.getValue().toString()).contains("filter=");
        }
    }

    // ===================================================================
    // createSupplier
    // ===================================================================

    @Test
    @DisplayName("createSupplier posts to /suppliers")
    void createSupplier_posts() {
        mockSuccessfulExchange(Map.of("id", 3L));

        Map<String, Object> result = client.createSupplier(ORG_ID, Map.of("name", "X"));

        assertThat(result).containsEntry("id", 3L);
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST),
            any(HttpEntity.class), any(ParameterizedTypeReference.class));
        assertThat(urlCaptor.getValue().toString()).endsWith("/suppliers");
    }

    // ===================================================================
    // findSupplierByExternalRef
    // ===================================================================

    @Nested
    @DisplayName("findSupplierByExternalRef")
    class FindSupplierByExternalRef {

        @Test
        @DisplayName("returns Optional.empty when none")
        void none_empty() {
            mockSuccessfulExchange(page(List.of()));

            Optional<Map<String, Object>> result = client.findSupplierByExternalRef(ORG_ID, "ref-x");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns first supplier when present")
        void found_returnsFirst() {
            Map<String, Object> supplier = Map.of("id", 10L, "name", "Acme", "external_reference", "ref-y");
            mockSuccessfulExchange(page(List.of(supplier)));

            Optional<Map<String, Object>> result = client.findSupplierByExternalRef(ORG_ID, "ref-y");

            assertThat(result).isPresent().get().isEqualTo(supplier);
        }

        @Test
        @DisplayName("rejects malformed response when 'suppliers' missing")
        void missing_empty() {
            mockSuccessfulExchange(Map.of());

            org.assertj.core.api.Assertions.assertThatThrownBy(() -> client.findSupplierByExternalRef(ORG_ID, "ref")).isInstanceOf(BaitlyPennylaneDiagnostics.Failure.class);
        }
    }

    // ===================================================================
    // listJournals
    // ===================================================================

    @Test
    @DisplayName("listJournals GETs /journals")
    void listJournals_gets() {
        Map<String, Object> body = Map.of("journals", List.of());
        mockSuccessfulExchange(body);

        Map<String, Object> result = client.listJournals(ORG_ID);

        assertThat(result).isEqualTo(body);
        ArgumentCaptor<URI> urlCaptor = ArgumentCaptor.forClass(URI.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
            any(HttpEntity.class), any(ParameterizedTypeReference.class));
        assertThat(urlCaptor.getValue().toString()).endsWith("/journals");
    }

    private static Map<String,Object> page(List<Map<String,Object>> items) {
        var result=new java.util.HashMap<String,Object>(); result.put("items",items);result.put("has_more",false);result.put("next_cursor",null);return result;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> ArgumentCaptor<HttpEntity<T>> entityCaptor() {
        return (ArgumentCaptor<HttpEntity<T>>) (ArgumentCaptor) ArgumentCaptor.forClass(HttpEntity.class);
    }
}
