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
            assertThat(urlCaptor.getValue()).isEqualTo(BASE_URL + "/customer_invoices");
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

            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue()).contains("limit=50");
            assertThat(urlCaptor.getValue()).doesNotContain("cursor=");
        }

        @Test
        @DisplayName("GETs with cursor and limit when both present")
        void withCursor_includesCursor() {
            mockSuccessfulExchange(Map.of());

            client.listCustomerInvoices(ORG_ID, "next-page", 25);

            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue()).contains("cursor=next-page");
            assertThat(urlCaptor.getValue()).contains("limit=25");
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
        assertThat(urlCaptor.getValue()).endsWith("/supplier_invoices");
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
        assertThat(urlCaptor.getValue()).endsWith("/customers");
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
            mockSuccessfulExchange(Map.of("customers", List.of()));

            Optional<Map<String, Object>> result = client.findCustomerByExternalRef(ORG_ID, "ref-123");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns first customer when present")
        void found_returnsFirst() {
            Map<String, Object> customer = Map.of("id", 1L, "name", "Alice");
            mockSuccessfulExchange(Map.of("customers", List.of(customer)));

            Optional<Map<String, Object>> result = client.findCustomerByExternalRef(ORG_ID, "ref-123");

            assertThat(result).isPresent().get().isEqualTo(customer);
        }

        @Test
        @DisplayName("returns empty when 'customers' key missing")
        void missingKey_empty() {
            mockSuccessfulExchange(Map.of());

            Optional<Map<String, Object>> result = client.findCustomerByExternalRef(ORG_ID, "ref");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL includes the filter parameter with external_reference")
        void buildsFilterUrl() {
            mockSuccessfulExchange(Map.of("customers", List.of()));

            client.findCustomerByExternalRef(ORG_ID, "ext-42");

            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), any(ParameterizedTypeReference.class));
            assertThat(urlCaptor.getValue()).contains("/customers");
            assertThat(urlCaptor.getValue()).contains("filter=");
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
        assertThat(urlCaptor.getValue()).endsWith("/suppliers");
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
            mockSuccessfulExchange(Map.of("suppliers", List.of()));

            Optional<Map<String, Object>> result = client.findSupplierByExternalRef(ORG_ID, "ref-x");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns first supplier when present")
        void found_returnsFirst() {
            Map<String, Object> supplier = Map.of("id", 10L, "name", "Acme");
            mockSuccessfulExchange(Map.of("suppliers", List.of(supplier)));

            Optional<Map<String, Object>> result = client.findSupplierByExternalRef(ORG_ID, "ref-y");

            assertThat(result).isPresent().get().isEqualTo(supplier);
        }

        @Test
        @DisplayName("returns empty when 'suppliers' missing")
        void missing_empty() {
            mockSuccessfulExchange(Map.of());

            assertThat(client.findSupplierByExternalRef(ORG_ID, "ref")).isEmpty();
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
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
            any(HttpEntity.class), any(ParameterizedTypeReference.class));
        assertThat(urlCaptor.getValue()).endsWith("/journals");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> ArgumentCaptor<HttpEntity<T>> entityCaptor() {
        return (ArgumentCaptor<HttpEntity<T>>) (ArgumentCaptor) ArgumentCaptor.forClass(HttpEntity.class);
    }
}
