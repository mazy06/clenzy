package com.clenzy.service.agent.tools;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Parsing partagé des arguments des tools batch (P2-12). */
final class BatchToolArgs {

    private BatchToolArgs() {}

    static List<Long> propertyIds(JsonNode args, String toolName) {
        JsonNode node = args != null ? args.get("propertyIds") : null;
        if (node == null || !node.isArray() || node.isEmpty()) {
            throw new IllegalArgumentException("propertyIds est requis (tableau non vide)");
        }
        List<Long> ids = new ArrayList<>();
        for (JsonNode el : node) {
            if (!el.canConvertToLong()) {
                throw new IllegalArgumentException("propertyIds doit contenir des entiers");
            }
            ids.add(el.asLong());
        }
        return ids;
    }

    static LocalDate date(JsonNode args, String field, String toolName) {
        String raw = args != null ? args.path(field).asText(null) : null;
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException(field + " est requis");
        }
        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            throw new IllegalArgumentException(field + " invalide : '" + raw + "' (format YYYY-MM-DD)");
        }
    }
}
