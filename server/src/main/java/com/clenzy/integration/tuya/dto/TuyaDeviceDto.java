package com.clenzy.integration.tuya.dto;

/**
 * Device decouvert sur le compte Tuya de l'organisation. La {@code category} Tuya brute est
 * incluse (ex : "sp"=camera, "ms"/"jtmspro"=serrure, "wk"=thermostat, "ldcg"=capteur) : le
 * wizard d'ajout plug-and-play filtre par categorie selon le type d'objet a creer.
 */
public record TuyaDeviceDto(
        String id,
        String name,
        String category,
        String productName,
        boolean online,
        /** True si ce device est deja rattache a l'organisation courante (decouverte). */
        boolean alreadyAdded
) {
}
