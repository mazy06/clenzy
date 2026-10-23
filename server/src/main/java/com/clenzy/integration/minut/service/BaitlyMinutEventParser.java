package com.clenzy.integration.minut.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Only stable, identified events can enter durable recovery. No synthetic identity. */
@Component
public class BaitlyMinutEventParser {
    public enum Kind { DISTURBANCE, OFFLINE, ONLINE }
    public record Input(String key, String fingerprint, String externalDevice, Kind kind, Double measuredDb, Instant occurredAt) {}
    private final ObjectMapper mapper;
    public BaitlyMinutEventParser(ObjectMapper mapper) { this.mapper = mapper; }

    public Optional<Input> parse(String payload) {
        try {
            Map<String,Object> root = mapper.readValue(payload, new TypeReference<>() {});
            Map<?,?> event = root.get("event") instanceof Map<?,?> nested ? nested : root;
            String type = string(event, "type", "event_type");
            Kind kind = switch (type == null ? "" : type.toLowerCase(Locale.ROOT)) {
                case "disturbance" -> Kind.DISTURBANCE;
                case "device_offline" -> Kind.OFFLINE;
                case "device_online" -> Kind.ONLINE;
                default -> null;
            };
            if (kind == null) return Optional.empty();
            String id = string(event, "webhook_event_id");
            String namespace = "webhook";
            if (id == null) { id = string(event, "id", "event_id"); namespace = "event"; }
            requireIdentifier(id);
            String external = string(event, "device_id");
            Map<?,?> data = event.get("data") instanceof Map<?,?> nested ? nested : Map.of();
            if (external == null) external = string(data, "device_id");
            requireIdentifier(external);
            Double level = null;
            if (kind == Kind.DISTURBANCE) {
                Object value = event.get("sound_level");
                if (value == null) value = data.get("sound_level");
                if (value == null) value = data.get("level");
                level = value instanceof Number number ? number.doubleValue() : Double.valueOf((String) value);
                if (!Double.isFinite(level) || level <= 0) return Optional.empty();
            }
            String time = string(event, "created_at", "event_time");
            Instant occurredAt=Instant.parse(time);
            // Serialization of a list is unambiguous, unlike concatenating free fields.
            String fingerprint = hash(mapper.writeValueAsString(Arrays.asList(kind.name(), external, level, occurredAt.toString())));
            return Optional.of(new Input(hash("minut:" + namespace + ":" + id), fingerprint, external, kind, level, occurredAt));
        } catch (Exception failure) {
            throw unavailable();
        }
    }

    private static String string(Map<?,?> input, String... keys) {
        String found = null;
        for (String key : keys) {
            Object value = input.get(key);
            if (value == null) continue;
            if (!(value instanceof String text) || text.isBlank()) throw unavailable();
            if (found != null && !found.equals(text)) throw unavailable();
            found = text;
        }
        return found;
    }
    private static void requireIdentifier(String value) {
        if (value == null || value.length() > 256 || value.chars().anyMatch(Character::isISOControl)) throw unavailable();
    }
    private static String hash(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }
    static IllegalStateException unavailable() { return new IllegalStateException("Traitement Minut non confirme ; consulter le journal interne"); }
}
