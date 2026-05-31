package com.clenzy.integration.hubspot.service;

import com.clenzy.integration.hubspot.config.HubSpotConfig;
import com.clenzy.integration.hubspot.dto.HubSpotContactDto;
import com.clenzy.integration.hubspot.dto.HubSpotDealDto;
import com.clenzy.integration.hubspot.dto.HubSpotTicketDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link HubSpotApiService}.
 *
 * <p>Covers contact / ticket / deal creation, contact lookup, header building
 * (bearer auth + JSON content type), and best-effort association calls.</p>
 *
 * <p>The service instantiates its own {@link RestTemplate}, so we inject the
 * mock via {@link ReflectionTestUtils}.</p>
 */
@ExtendWith(MockitoExtension.class)
class HubSpotApiServiceTest {

    private static final String BASE_URL = "https://api.hubapi.com";

    @Mock private HubSpotConfig config;
    @Mock private RestTemplate restTemplate;

    private HubSpotApiService service;

    @BeforeEach
    void setUp() {
        service = new HubSpotApiService(config);
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubExchange(HttpMethod method, Map<String, Object> body) {
        ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(method), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(response);
    }

    // ===================================================================
    // createOrUpdateContact
    // ===================================================================

    @Nested
    @DisplayName("createOrUpdateContact")
    class CreateOrUpdateContact {

        @Test
        @DisplayName("returns contact id and sends required properties")
        void whenAllFieldsPresent_thenSendsCompletePayload() {
            // Arrange
            when(config.getApiKey()).thenReturn("api-key-123");
            stubExchange(HttpMethod.POST, Map.of("id", "contact-42"));

            HubSpotContactDto dto = new HubSpotContactDto(
                    "alice@example.com", "Alice", "Smith",
                    "+33611111111", "Acme",
                    Map.of("lifecycle_stage", "lead"));

            // Act
            String id = service.createOrUpdateContact(dto);

            // Assert
            assertThat(id).isEqualTo("contact-42");

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(
                    eq(BASE_URL + "/crm/v3/objects/contacts"),
                    eq(HttpMethod.POST),
                    captor.capture(),
                    eq(Map.class));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) body.get("properties");
            assertThat(properties)
                    .containsEntry("email", "alice@example.com")
                    .containsEntry("firstname", "Alice")
                    .containsEntry("lastname", "Smith")
                    .containsEntry("phone", "+33611111111")
                    .containsEntry("company", "Acme")
                    .containsEntry("lifecycle_stage", "lead");

            HttpHeaders headers = captor.getValue().getHeaders();
            assertThat(headers.getFirst("Authorization")).isEqualTo("Bearer api-key-123");
            assertThat(headers.getContentType().toString()).startsWith("application/json");
        }

        @Test
        @DisplayName("omits optional fields when null")
        void whenOptionalFieldsNull_thenOmitsThem() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            stubExchange(HttpMethod.POST, Map.of("id", "contact-1"));

            HubSpotContactDto dto = new HubSpotContactDto(
                    "bob@example.com", "Bob", "Jones", null, null, null);

            // Act
            String id = service.createOrUpdateContact(dto);

            // Assert
            assertThat(id).isEqualTo("contact-1");

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST),
                    captor.capture(), eq(Map.class));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) body.get("properties");
            assertThat(properties).doesNotContainKeys("phone", "company");
            assertThat(properties).containsEntry("email", "bob@example.com");
        }
    }

    // ===================================================================
    // createTicket
    // ===================================================================

    @Nested
    @DisplayName("createTicket")
    class CreateTicket {

        @Test
        @DisplayName("returns ticket id and posts required properties")
        void whenCalled_thenReturnsIdAndSendsPayload() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            stubExchange(HttpMethod.POST, Map.of("id", "ticket-99"));

            HubSpotTicketDto dto = new HubSpotTicketDto(
                    "Issue", "Description here",
                    HubSpotTicketDto.Priority.HIGH,
                    "support-pipe", "stage-1", null);

            // Act
            String id = service.createTicket(dto);

            // Assert
            assertThat(id).isEqualTo("ticket-99");

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(
                    eq(BASE_URL + "/crm/v3/objects/tickets"),
                    eq(HttpMethod.POST), captor.capture(), eq(Map.class));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) body.get("properties");
            assertThat(properties)
                    .containsEntry("subject", "Issue")
                    .containsEntry("content", "Description here")
                    .containsEntry("hs_pipeline", "support-pipe")
                    .containsEntry("hs_pipeline_stage", "stage-1")
                    .containsEntry("hs_ticket_priority", "HIGH");
        }

        @Test
        @DisplayName("associates contact when contactId provided")
        void whenContactIdProvided_thenAssociatesContact() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            // 1st call : create ticket; 2nd call : association PUT
            @SuppressWarnings({"unchecked", "rawtypes"})
            ResponseEntity<Map> created = new ResponseEntity<>(
                    Map.of("id", "ticket-99"), HttpStatus.OK);
            when(restTemplate.exchange(contains("/tickets"), eq(HttpMethod.POST),
                    any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(created);

            HubSpotTicketDto dto = new HubSpotTicketDto(
                    "Sub", "Content", HubSpotTicketDto.Priority.LOW,
                    "pipe", "stage", "contact-5");

            // Act
            String id = service.createTicket(dto);

            // Assert
            assertThat(id).isEqualTo("ticket-99");
            // The association call goes through restTemplate.exchange(... PUT ...).
            verify(restTemplate).exchange(
                    contains("/tickets/ticket-99/associations/contacts/contact-5/16"),
                    eq(HttpMethod.PUT), any(HttpEntity.class), eq(Void.class));
        }
    }

    // ===================================================================
    // createDeal
    // ===================================================================

    @Nested
    @DisplayName("createDeal")
    class CreateDeal {

        @Test
        @DisplayName("returns deal id and sends full payload incl. closeDate")
        void whenCloseDateProvided_thenIncludedInPayload() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            stubExchange(HttpMethod.POST, Map.of("id", "deal-7"));

            HubSpotDealDto dto = new HubSpotDealDto(
                    "Big sale", "1000.00", "stage-x", "pipe-x",
                    "2026-12-31", null,
                    Map.of("source", "inbound"));

            // Act
            String id = service.createDeal(dto);

            // Assert
            assertThat(id).isEqualTo("deal-7");

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(
                    eq(BASE_URL + "/crm/v3/objects/deals"),
                    eq(HttpMethod.POST), captor.capture(), eq(Map.class));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) body.get("properties");
            assertThat(properties)
                    .containsEntry("dealname", "Big sale")
                    .containsEntry("amount", "1000.00")
                    .containsEntry("dealstage", "stage-x")
                    .containsEntry("pipeline", "pipe-x")
                    .containsEntry("closedate", "2026-12-31")
                    .containsEntry("source", "inbound");
        }

        @Test
        @DisplayName("omits closeDate when null")
        void whenCloseDateNull_thenOmitsIt() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            stubExchange(HttpMethod.POST, Map.of("id", "deal-8"));

            HubSpotDealDto dto = new HubSpotDealDto(
                    "Small sale", "50", "stage", "pipe", null, null, null);

            // Act
            service.createDeal(dto);

            // Assert
            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST),
                    captor.capture(), eq(Map.class));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) body.get("properties");
            assertThat(properties).doesNotContainKey("closedate");
        }

        @Test
        @DisplayName("associates contact when contactId provided")
        void whenContactIdProvided_thenAssociatesContact() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            @SuppressWarnings({"unchecked", "rawtypes"})
            ResponseEntity<Map> created = new ResponseEntity<>(
                    Map.of("id", "deal-7"), HttpStatus.OK);
            when(restTemplate.exchange(contains("/deals"), eq(HttpMethod.POST),
                    any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(created);

            HubSpotDealDto dto = new HubSpotDealDto(
                    "Sale", "100", "stage", "pipe", null, "contact-3", null);

            // Act
            service.createDeal(dto);

            // Assert
            verify(restTemplate).exchange(
                    contains("/deals/deal-7/associations/contacts/contact-3/3"),
                    eq(HttpMethod.PUT), any(HttpEntity.class), eq(Void.class));
        }

        @Test
        @DisplayName("succeeds even if association call fails (best-effort)")
        void whenAssociationFails_thenStillReturnsDealId() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            @SuppressWarnings({"unchecked", "rawtypes"})
            ResponseEntity<Map> created = new ResponseEntity<>(
                    Map.of("id", "deal-9"), HttpStatus.OK);
            when(restTemplate.exchange(contains("/deals"), eq(HttpMethod.POST),
                    any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(created);
            when(restTemplate.exchange(contains("/associations"), eq(HttpMethod.PUT),
                    any(HttpEntity.class), eq(Void.class)))
                    .thenThrow(new RestClientException("boom"));

            HubSpotDealDto dto = new HubSpotDealDto(
                    "Sale", "100", "stage", "pipe", null, "contact-3", null);

            // Act
            String id = service.createDeal(dto);

            // Assert — exception swallowed, primary id returned
            assertThat(id).isEqualTo("deal-9");
        }
    }

    // ===================================================================
    // getContact
    // ===================================================================

    @Nested
    @DisplayName("getContact")
    class GetContact {

        @Test
        @DisplayName("returns mapped DTO from properties payload")
        void whenContactFound_thenReturnsDto() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            Map<String, String> props = Map.of(
                    "email", "alice@example.com",
                    "firstname", "Alice",
                    "lastname", "Smith",
                    "phone", "+33611111111",
                    "company", "Acme");
            @SuppressWarnings({"unchecked", "rawtypes"})
            ResponseEntity<Map> response = new ResponseEntity<>(
                    Map.of("properties", props), HttpStatus.OK);
            when(restTemplate.exchange(contains("/crm/v3/objects/contacts/contact-1"),
                    eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);

            // Act
            HubSpotContactDto dto = service.getContact("contact-1");

            // Assert
            assertThat(dto.email()).isEqualTo("alice@example.com");
            assertThat(dto.firstName()).isEqualTo("Alice");
            assertThat(dto.lastName()).isEqualTo("Smith");
            assertThat(dto.phone()).isEqualTo("+33611111111");
            assertThat(dto.company()).isEqualTo("Acme");
            assertThat(dto.properties()).containsEntry("email", "alice@example.com");
        }

        @Test
        @DisplayName("requests email/firstname/lastname/phone/company properties only")
        void whenCalled_thenRequestsExpectedProperties() {
            // Arrange
            when(config.getApiKey()).thenReturn("k");
            @SuppressWarnings({"unchecked", "rawtypes"})
            ResponseEntity<Map> response = new ResponseEntity<>(
                    Map.of("properties", Map.of("email", "x@x")),
                    HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET),
                    any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);

            // Act
            service.getContact("contact-1");

            // Assert
            verify(restTemplate).exchange(
                    contains("properties=email,firstname,lastname,phone,company"),
                    eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class));
        }
    }
}
