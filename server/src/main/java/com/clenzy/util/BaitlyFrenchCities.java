package com.clenzy.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.Map;
import com.clenzy.marketplace.sectors.SectorKey;

/** Noms officiels des communes, partagés avec les choix du formulaire Baitly. */
public final class BaitlyFrenchCities {
    private BaitlyFrenchCities() {}
    private static class Catalog {
        static final Map<String, Map<String, String>> NAMES = load();
        private static Map<String, Map<String, String>> load() {
            try (var input = new ClassPathResource("geo/baitly-communes.json").getInputStream()) {
                JsonNode root = new ObjectMapper().readTree(input);
                var result = new HashMap<String, Map<String, String>>();
                root.fields().forEachRemaining(entry -> {
                    var names = new HashMap<String, String>();
                    entry.getValue().forEach(name -> names.put(SectorKey.normalizeCity(name.asText()), name.asText()));
                    result.put(entry.getKey(), Map.copyOf(names));
                });
                return Map.copyOf(result);
            } catch (IOException e) { throw new UncheckedIOException("Catalogue des communes illisible", e); }
        }
    }

    public static String requireValid(String country, String department, String arrondissement, String city) {
        if (city == null || city.isBlank()) return null; // Vide = département entier, ou arrondissement.
        if (!"FR".equalsIgnoreCase(country == null ? "" : country.trim())) return city.trim();
        String canonical = Catalog.NAMES.getOrDefault(department == null ? "" : department.trim().toUpperCase(java.util.Locale.ROOT), Map.of())
                .get(SectorKey.normalizeCity(city));
        if (canonical == null) throw new IllegalArgumentException("Choisissez une ville du département sélectionné");
        if (arrondissement != null && !arrondissement.isBlank()) {
            String parent = switch (department.trim()) { case "75" -> "Paris"; case "69" -> "Lyon"; case "13" -> "Marseille"; default -> ""; };
            if (!canonical.equals(parent)) throw new IllegalArgumentException("L'arrondissement ne correspond pas à cette ville");
        }
        return canonical;
    }
}
