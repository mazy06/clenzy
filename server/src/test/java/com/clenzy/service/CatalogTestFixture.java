package com.clenzy.service;

import com.clenzy.service.catalog.ServiceCatalogReference;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/** Adaptateur sans BDD pour les tests de prix ; la résolution SQL est testée sur PostgreSQL. */
public final class CatalogTestFixture {
    private CatalogTestFixture() {}
    public static ServiceCatalogReference reference() {
        Map<String,String> aliases = new LinkedHashMap<>();
        try (var stream = CatalogTestFixture.class.getResourceAsStream("/db/changelog/changes/0461__canonical_service_references.sql")) {
            var matcher = java.util.regex.Pattern.compile("\\('([A-Z_]+)','([a-z-]+)'\\)")
                .matcher(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            while (matcher.find()) aliases.put(matcher.group(1), matcher.group(2));
        } catch (java.io.IOException failure) { throw new java.io.UncheckedIOException(failure); }
        return new ServiceCatalogReference(null) {
            @Override public boolean isRemote(String code) { return false; }
            @Override public boolean doesNotReserveSlot(String code) { return false; }
            @Override public boolean propertyOptional(String code) { return false; }
            @Override public String resolve(String explicit, String legacy, String existing, String previous) {
                if (explicit != null) return explicit;
                if (existing != null && (legacy == null || java.util.Objects.equals(legacy,previous))) return existing;
                return legacyCode(legacy);
            }
            @Override public String legacyCode(String type) { return aliases.get(type); }
            @Override public String legacyType(String code) {
                return aliases.entrySet().stream().filter(e -> e.getValue().equals(code))
                    .map(Map.Entry::getKey).findFirst().orElse("OTHER");
            }
        };
    }
}
