package com.clenzy.integration.brevo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Client bas niveau de l'API Brevo v3 (Contacts / Lists).
 *
 * Sans etat et sans dependance a la config : toutes les methodes prennent la
 * cle API + l'URL de base en parametres. Cela evite toute dependance circulaire
 * avec {@code MarketingIntegrationService} (qui resout la config) et permet de
 * tester une cle avant de la persister.
 *
 * Les methodes propagent les exceptions HTTP (4xx/5xx) — l'appelant decide de
 * la strategie (best-effort pour la sync, remontee d'erreur pour le test).
 */
@Component
public class BrevoApiClient {

    private static final Logger log = LoggerFactory.getLogger(BrevoApiClient.class);

    public static final String DEFAULT_BASE_URL = "https://api.brevo.com/v3";

    private final RestClient restClient = RestClient.create();

    /** Une liste de contacts Brevo (pour le mapping cote UI). */
    public record BrevoList(long id, String name, Long totalSubscribers) {}

    /**
     * Cree ou met a jour un contact et l'ajoute aux listes donnees.
     * @throws org.springframework.web.client.RestClientException en cas d'echec HTTP.
     */
    public void upsertContact(String apiKey, String baseUrl, String email,
                              Map<String, Object> attributes, List<Long> listIds, boolean updateEnabled) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        if (attributes != null && !attributes.isEmpty()) body.put("attributes", attributes);
        if (listIds != null && !listIds.isEmpty()) body.put("listIds", listIds);
        body.put("updateEnabled", updateEnabled);

        restClient.post()
                .uri(base(baseUrl) + "/contacts")
                .header("api-key", apiKey)
                .header("accept", "application/json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    /** Retire un contact d'une liste (ex : desinscription via webhook). */
    public void removeContactFromList(String apiKey, String baseUrl, long listId, String email) {
        restClient.post()
                .uri(base(baseUrl) + "/contacts/lists/" + listId + "/contacts/remove")
                .header("api-key", apiKey)
                .header("accept", "application/json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("emails", List.of(email)))
                .retrieve()
                .toBodilessEntity();
    }

    /**
     * Liste les listes de contacts Brevo (pour peupler le mapping cote UI et
     * valider la cle au moment du test de connexion).
     * @throws org.springframework.web.client.RestClientException si la cle est invalide.
     */
    @SuppressWarnings("unchecked")
    public List<BrevoList> fetchLists(String apiKey, String baseUrl) {
        Map<String, Object> resp = restClient.get()
                .uri(base(baseUrl) + "/contacts/lists?limit=50&offset=0&sort=desc")
                .header("api-key", apiKey)
                .header("accept", "application/json")
                .retrieve()
                .body(Map.class);

        List<BrevoList> out = new ArrayList<>();
        if (resp != null && resp.get("lists") instanceof List<?> lists) {
            for (Object o : lists) {
                if (o instanceof Map<?, ?> m && m.get("id") instanceof Number id) {
                    Long subs = (m.get("totalSubscribers") instanceof Number n) ? n.longValue() : null;
                    out.add(new BrevoList(id.longValue(), String.valueOf(m.get("name")), subs));
                }
            }
        }
        return out;
    }

    private String base(String baseUrl) {
        return (baseUrl == null || baseUrl.isBlank()) ? DEFAULT_BASE_URL : baseUrl;
    }
}
