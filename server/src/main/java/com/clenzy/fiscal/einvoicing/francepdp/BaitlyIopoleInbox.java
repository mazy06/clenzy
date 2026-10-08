package com.clenzy.fiscal.einvoicing.francepdp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Consomme les lots PULL de 100 statuts, sans utiliser l'historique distant pour le polling. */
@Component
public class BaitlyIopoleInbox {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final BaitlyIopoleApi api;
    private final BaitlyIopoleInboxStore store;
    public BaitlyIopoleInbox(BaitlyIopoleApi api, BaitlyIopoleInboxStore store) { this.api = api; this.store = store; }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public JsonNode refresh(Long organization, String environment, UUID customer, UUID invoice) {
        // Borné pour ne pas monopoliser le worker ; un lot plein exige une lecture supplémentaire.
        for (int page = 0; page < 5; page++) {
            var events = parse(api.unseen(customer));
            store.retain(organization, environment, customer, events);
            for (var event : events) api.acknowledge(customer, event.status());
            if (events.size() < 100) {
                var history = JSON.createArrayNode();
                try { for (String body : store.history(organization, environment, customer, invoice)) history.add(JSON.readTree(body)); }
                catch (Exception e) { throw new IllegalStateException("Historique Iopole local illisible"); }
                return history;
            }
        }
        throw new IllegalStateException("Flux Iopole encore incomplet ; reprise au prochain passage");
    }

    static List<BaitlyIopoleInboxStore.Event> parse(JsonNode groups) {
        if (!groups.isArray() || groups.size() > 100) throw new IllegalStateException("Lot Iopole invalide");
        var result = new ArrayList<BaitlyIopoleInboxStore.Event>();
        var seen = new HashSet<UUID>();
        for (var group : groups) {
            UUID invoice = UUID.fromString(group.path("invoiceId").asText());
            var statuses = group.path("newstatus");
            if (!statuses.isArray()) throw new IllegalStateException("Lot Iopole sans statuts");
            for (var item : statuses) {
                if (result.size() >= 100) throw new IllegalStateException("Lot Iopole trop volumineux");
                UUID status = UUID.fromString(item.path("statusId").asText());
                if (!seen.add(status) || !invoice.equals(UUID.fromString(item.path("invoiceId").asText()))) throw new IllegalStateException("Références Iopole contradictoires");
                String destination = item.path("destType").asText();
                if (!Set.of("OPERATOR", "PLATFORM", "PPF").contains(destination)) throw new IllegalStateException("Destination Iopole inconnue");
                var body = JSON.createObjectNode();
                body.put("statusId", status.toString()).put("invoiceId", invoice.toString())
                    .put("date", Instant.parse(item.path("date").asText()).toString()).put("destType", destination);
                var code = body.putObject("status");
                code.put("code", bounded(item.path("status").path("code").asText(), true));
                code.put("networkCode", bounded(item.path("status").path("networkCode").asText(), false));
                result.add(new BaitlyIopoleInboxStore.Event(status, invoice, body.toString()));
            }
        }
        return List.copyOf(result);
    }

    private static String bounded(String value, boolean required) {
        if (value.length() > 80 || required && value.isBlank()) throw new IllegalStateException("Statut Iopole invalide");
        return value;
    }
}
