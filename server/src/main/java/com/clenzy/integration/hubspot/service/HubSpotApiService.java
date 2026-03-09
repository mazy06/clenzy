package com.clenzy.integration.hubspot.service;

import com.clenzy.integration.hubspot.config.HubSpotConfig;
import com.clenzy.integration.hubspot.dto.HubSpotContactDto;
import com.clenzy.integration.hubspot.dto.HubSpotDealDto;
import com.clenzy.integration.hubspot.dto.HubSpotTicketDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Service d'appel a l'API HubSpot CRM v3.
 * Gere les contacts, tickets et deals.
 *
 * Circuit breaker : toutes les methodes d'appel API sont protegees
 * pour eviter la cascade d'erreurs en cas d'indisponibilite HubSpot.
 */
@Service
@ConditionalOnProperty(name = "clenzy.hubspot.api-key")
public class HubSpotApiService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotApiService.class);
    private static final String BASE_URL = "https://api.hubapi.com";

    private final HubSpotConfig config;
    private final RestTemplate restTemplate;

    public HubSpotApiService(HubSpotConfig config) {
        this.config = config;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Cree ou met a jour un contact dans HubSpot.
     *
     * @param dto donnees du contact
     * @return identifiant HubSpot du contact cree/mis a jour
     */
    @CircuitBreaker(name = "hubspot-api", fallbackMethod = "createOrUpdateContactFallback")
    public String createOrUpdateContact(HubSpotContactDto dto) {
        log.info("HubSpot — creation/mise a jour contact: {}", dto.email());

        Map<String, Object> properties = new HashMap<>();
        properties.put("email", dto.email());
        properties.put("firstname", dto.firstName());
        properties.put("lastname", dto.lastName());
        if (dto.phone() != null) {
            properties.put("phone", dto.phone());
        }
        if (dto.company() != null) {
            properties.put("company", dto.company());
        }
        if (dto.properties() != null) {
            properties.putAll(dto.properties());
        }

        Map<String, Object> body = Map.of("properties", properties);

        ResponseEntity<Map> response = restTemplate.exchange(
            BASE_URL + "/crm/v3/objects/contacts",
            HttpMethod.POST,
            new HttpEntity<>(body, buildHeaders()),
            Map.class
        );

        String contactId = String.valueOf(response.getBody().get("id"));
        log.info("HubSpot — contact cree/mis a jour: {}", contactId);
        return contactId;
    }

    /**
     * Cree un ticket dans HubSpot.
     *
     * @param dto donnees du ticket
     * @return identifiant HubSpot du ticket cree
     */
    @CircuitBreaker(name = "hubspot-api", fallbackMethod = "createTicketFallback")
    public String createTicket(HubSpotTicketDto dto) {
        log.info("HubSpot — creation ticket: {}", dto.subject());

        Map<String, Object> properties = new HashMap<>();
        properties.put("subject", dto.subject());
        properties.put("content", dto.content());
        properties.put("hs_pipeline", dto.pipeline());
        properties.put("hs_pipeline_stage", dto.stage());
        properties.put("hs_ticket_priority", dto.priority().name());

        Map<String, Object> body = Map.of("properties", properties);

        ResponseEntity<Map> response = restTemplate.exchange(
            BASE_URL + "/crm/v3/objects/tickets",
            HttpMethod.POST,
            new HttpEntity<>(body, buildHeaders()),
            Map.class
        );

        String ticketId = String.valueOf(response.getBody().get("id"));
        log.info("HubSpot — ticket cree: {}", ticketId);

        if (dto.contactId() != null) {
            associateContactToTicket(ticketId, dto.contactId());
        }

        return ticketId;
    }

    /**
     * Cree un deal dans HubSpot.
     *
     * @param dto donnees du deal
     * @return identifiant HubSpot du deal cree
     */
    @CircuitBreaker(name = "hubspot-api", fallbackMethod = "createDealFallback")
    public String createDeal(HubSpotDealDto dto) {
        log.info("HubSpot — creation deal: {}", dto.dealName());

        Map<String, Object> properties = new HashMap<>();
        properties.put("dealname", dto.dealName());
        properties.put("amount", dto.amount());
        properties.put("dealstage", dto.stage());
        properties.put("pipeline", dto.pipeline());
        if (dto.closeDate() != null) {
            properties.put("closedate", dto.closeDate());
        }
        if (dto.properties() != null) {
            properties.putAll(dto.properties());
        }

        Map<String, Object> body = Map.of("properties", properties);

        ResponseEntity<Map> response = restTemplate.exchange(
            BASE_URL + "/crm/v3/objects/deals",
            HttpMethod.POST,
            new HttpEntity<>(body, buildHeaders()),
            Map.class
        );

        String dealId = String.valueOf(response.getBody().get("id"));
        log.info("HubSpot — deal cree: {}", dealId);

        if (dto.contactId() != null) {
            associateContactToDeal(dealId, dto.contactId());
        }

        return dealId;
    }

    /**
     * Recupere un contact HubSpot par son identifiant.
     *
     * @param contactId identifiant du contact
     * @return donnees du contact
     */
    @CircuitBreaker(name = "hubspot-api", fallbackMethod = "getContactFallback")
    public HubSpotContactDto getContact(String contactId) {
        log.debug("HubSpot — recuperation contact: {}", contactId);

        ResponseEntity<Map> response = restTemplate.exchange(
            BASE_URL + "/crm/v3/objects/contacts/" + contactId
                + "?properties=email,firstname,lastname,phone,company",
            HttpMethod.GET,
            new HttpEntity<>(buildHeaders()),
            Map.class
        );

        @SuppressWarnings("unchecked")
        Map<String, String> props = (Map<String, String>) response.getBody().get("properties");

        return new HubSpotContactDto(
            props.get("email"),
            props.get("firstname"),
            props.get("lastname"),
            props.get("phone"),
            props.get("company"),
            props
        );
    }

    // ─── Association helpers ──────────────────────────────────────────────────

    private void associateContactToTicket(String ticketId, String contactId) {
        try {
            restTemplate.exchange(
                BASE_URL + "/crm/v3/objects/tickets/" + ticketId
                    + "/associations/contacts/" + contactId + "/16",
                HttpMethod.PUT,
                new HttpEntity<>(buildHeaders()),
                Void.class
            );
            log.debug("HubSpot — contact {} associe au ticket {}", contactId, ticketId);
        } catch (Exception e) {
            log.warn("HubSpot — echec association contact/ticket: {}", e.getMessage());
        }
    }

    private void associateContactToDeal(String dealId, String contactId) {
        try {
            restTemplate.exchange(
                BASE_URL + "/crm/v3/objects/deals/" + dealId
                    + "/associations/contacts/" + contactId + "/3",
                HttpMethod.PUT,
                new HttpEntity<>(buildHeaders()),
                Void.class
            );
            log.debug("HubSpot — contact {} associe au deal {}", contactId, dealId);
        } catch (Exception e) {
            log.warn("HubSpot — echec association contact/deal: {}", e.getMessage());
        }
    }

    // ─── Headers ──────────────────────────────────────────────────────────────

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiKey());
        return headers;
    }

    // ─── Fallback methods ─────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private String createOrUpdateContactFallback(HubSpotContactDto dto, Throwable t) {
        log.error("Circuit breaker HubSpot ouvert — fallback createOrUpdateContact: {}", t.getMessage());
        throw new RuntimeException("Service HubSpot CRM temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private String createTicketFallback(HubSpotTicketDto dto, Throwable t) {
        log.error("Circuit breaker HubSpot ouvert — fallback createTicket: {}", t.getMessage());
        throw new RuntimeException("Service HubSpot CRM temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private String createDealFallback(HubSpotDealDto dto, Throwable t) {
        log.error("Circuit breaker HubSpot ouvert — fallback createDeal: {}", t.getMessage());
        throw new RuntimeException("Service HubSpot CRM temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private HubSpotContactDto getContactFallback(String contactId, Throwable t) {
        log.error("Circuit breaker HubSpot ouvert — fallback getContact: {}", t.getMessage());
        throw new RuntimeException("Service HubSpot CRM temporairement indisponible", t);
    }
}
