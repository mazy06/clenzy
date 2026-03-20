package com.clenzy.model;

import java.util.Map;
import java.util.Optional;

public final class HardwareCatalog {

    public record Product(String sku, String name, int priceInCents, String category) {}

    private static final Map<String, Product> PRODUCTS = Map.ofEntries(
        Map.entry("CLENZY-NM-01", new Product("CLENZY-NM-01", "Capteur Bruit 5-in-1", 4900, "noise")),
        Map.entry("CLENZY-SL-01", new Product("CLENZY-SL-01", "Serrure Connectée", 14900, "lock")),
        Map.entry("CLENZY-TH-01", new Product("CLENZY-TH-01", "Capteur Temp/Humidité", 1900, "environment")),
        Map.entry("CLENZY-DW-01", new Product("CLENZY-DW-01", "Capteur Porte/Fenêtre", 1200, "environment")),
        Map.entry("CLENZY-MO-01", new Product("CLENZY-MO-01", "Capteur Mouvement", 1500, "environment")),
        Map.entry("CLENZY-SM-01", new Product("CLENZY-SM-01", "Détecteur Fumée/Vape", 2900, "environment")),
        Map.entry("KIT-ESSENTIAL", new Product("KIT-ESSENTIAL", "Kit Essentiel", 7900, "kit")),
        Map.entry("KIT-SECURITY", new Product("KIT-SECURITY", "Kit Sécurité", 16900, "kit")),
        Map.entry("KIT-COMPLETE", new Product("KIT-COMPLETE", "Kit Complet", 25900, "kit"))
    );

    private HardwareCatalog() {}

    public static Optional<Product> findBySku(String sku) {
        return Optional.ofNullable(PRODUCTS.get(sku));
    }

    public static Map<String, Product> getAll() {
        return PRODUCTS;
    }
}
