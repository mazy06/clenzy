package com.clenzy.marketplace.service;

import java.util.*;

/** Discovery presets reuse the marketplace service families; NAF describes registered activity only. */
public final class BaitlyProfessionalSearchFilters {
    private BaitlyProfessionalSearchFilters() {}
    public static final Map<String,Set<String>> SERVICES=Map.ofEntries(
        Map.entry("CLEANING",Set.of("81.21Z","81.22Z","81.29B")),
        Map.entry("MAINTENANCE",Set.of("43.21A","43.22A","43.22B","43.32A","43.32B","43.39Z","43.11Z","43.12A","43.12B","43.13Z","43.21B","43.29A","43.29B","43.31Z","43.32C","43.33Z","43.34Z","43.91A","43.91B","43.99A","43.99B","43.99C","43.99D","43.99E")),
        Map.entry("LAUNDRY",Set.of("96.01A","96.01B")),
        Map.entry("EXTERIOR",Set.of("81.30Z")),
        Map.entry("CONCIERGE",Set.of("81.10Z","68.32A")),
        Map.entry("REPAIRS",Set.of("95.11Z","95.12Z","95.21Z","95.22Z","95.23Z","95.24Z","95.25Z","95.29Z")),
        Map.entry("SECURITY",Set.of("80.10Z","80.20Z","80.30Z")),
        Map.entry("PEST_CONTROL",Set.of("81.29A")),
        Map.entry("CATERING",Set.of("56.10A","56.10B","56.10C","56.21Z","56.29A","56.29B","56.30Z")),
        Map.entry("MOVING",Set.of("49.42Z","52.10B")),
        Map.entry("PROPERTY_EXPERTS",Set.of("71.12B","71.20B","74.10Z","77.29Z")));
    public static Set<String> activities(String service) {
        if(service==null||service.isBlank())return Set.of();
        var codes=SERVICES.get(service);
        if(codes==null)throw new IllegalArgumentException("Type de service invalide");
        return codes;
    }
    /** Bounded read-only service union; ingestion and discovery identities still use a single family. */
    public static List<String> readServices(String value){
        if(value==null||value.isBlank())return List.of();
        if(value.length()>300)throw new IllegalArgumentException("Type de service invalide");
        var services=Arrays.stream(value.split(",",-1)).map(String::strip).distinct().sorted().toList();
        if(services.size()>SERVICES.size()||services.stream().anyMatch(code->!SERVICES.containsKey(code)))throw new IllegalArgumentException("Type de service invalide");
        return services;
    }
    public static Set<String> communes(String code) {
        if(code==null||code.isBlank())return Set.of();
        if(!code.matches("[0-9AB]{5}"))throw new IllegalArgumentException("Ville invalide");
        // Sirene uses municipal arrondissement codes for these three cities.
        return switch(code) {
            case "75056" -> arrondissements(75101,20);
            case "69123" -> arrondissements(69381,9);
            case "13055" -> arrondissements(13201,16);
            default -> Set.of(code);
        };
    }
    private static Set<String> arrondissements(int first,int count) {
        var codes=new TreeSet<String>();for(int i=0;i<count;i++)codes.add(String.valueOf(first+i));return codes;
    }
    public static String csv(Set<String> codes){return String.join(",",new TreeSet<>(codes));}
}
