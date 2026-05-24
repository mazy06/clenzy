package com.clenzy.dto.amenity;

import java.util.List;

/**
 * Aggregat d'une amenity OTA brute trouvee sur les properties de l'org,
 * sans alias ni ignored existant. Sert d'item dans la liste "A mapper".
 *
 * @param rawOtaName            nom brut tel qu'expose par l'OTA (ex "Smoke alarm")
 * @param occurrences           nombre de properties qui ont ce nom
 * @param affectedProperties    apercu des 5 premieres properties affectees (id + name)
 * @param otaSources            sources OTA distinctes qui exposent ce nom (ex ["AirBNB"])
 */
public record UnmappedAmenityDto(
    String rawOtaName,
    int occurrences,
    List<PropertyRef> affectedProperties,
    List<String> otaSources
) {
    public record PropertyRef(Long id, String name) {}
}
