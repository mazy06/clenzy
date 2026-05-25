package com.clenzy.dto;

/**
 * Vue API d'un override d'icone de commodite. Sert pour le GET (liste / single)
 * et pour le PUT (upsert).
 *
 * @param amenityCode code Clenzy (WIFI, POOL, custom_amenities.code...)
 * @param iconName    nom du composant lucide-react (Wifi, Waves, ChefHat...)
 */
public record AmenityIconOverrideDto(
        String amenityCode,
        String iconName
) {}
