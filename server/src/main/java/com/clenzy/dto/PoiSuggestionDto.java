package com.clenzy.dto;

import java.io.Serializable;

/**
 * Suggestion de point d'intérêt auto-populée (OpenStreetMap / Overpass) autour
 * d'un logement. L'hôte choisit lesquelles importer dans son « autour de moi ».
 * Serializable pour le cache Redis.
 */
public record PoiSuggestionDto(String category, String name, String address, double lat, double lng)
        implements Serializable {}
