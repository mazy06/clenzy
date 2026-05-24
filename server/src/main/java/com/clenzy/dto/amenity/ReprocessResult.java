package com.clenzy.dto.amenity;

/**
 * Resultat d'un reprocess : applique aliases + ignored a toutes les
 * properties de l'org qui ont {@code ota_raw_amenities} non-null.
 */
public record ReprocessResult(
    int propertiesScanned,
    int propertiesUpdated,
    int totalRawAmenitiesProcessed,
    int totalMappedAdded,
    int totalIgnoredRemoved,
    int totalLeftUnmapped
) {}
