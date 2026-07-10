package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Payload de creation d'une Property cote Channex.
 *
 * <p>Format accepte : {@code { "property": { title, currency, country, timezone, ... } }}
 * (alternative documentee au JSON:API strict pour POST /api/v1/properties).</p>
 *
 * <p>Champs requis par Channex : title, currency, country, timezone. Les champs
 * de contact/adresse (email, phone, zip_code, city, address, latitude,
 * longitude) sont optionnels a la creation mais <b>REQUIS des la connexion du
 * premier channel OTA</b> (doc Channex, Properties Collection) — on les envoie
 * donc des la creation quand la donnee Clenzy existe.</p>
 *
 * <p>{@code property_type} : "apartment" pour les locations saisonnieres —
 * ce champ conditionne la <b>facturation Channex</b> (bareme Vacation Rental
 * vs hotel) et les prerequis Google VR.</p>
 *
 * <p>Le {@code group_id} est OPTIONNEL : il faut omettre le champ (pas envoyer
 * une chaine vide) si la property n'appartient a aucun groupe — sinon
 * Channex renvoie 400 "group_id property is invalid".</p>
 *
 * <p>{@code settings} : bloc de reglages pousses a la creation —
 * {@code allow_availability_autoupdate_on_modification/cancellation=false}
 * (le PMS reste l'unique maitre de l'availability),
 * {@code state_length} (longueur d'inventaire, alignee sur la fenetre de full
 * sync, bornee 100-730 par Channex), {@code min_stay_type}.</p>
 */
public record ChannexCreatePropertyRequest(
    String title,
    String currency,
    String country,
    String timezone,
    @JsonProperty("group_id") String groupId,
    String email,
    String phone,
    @JsonProperty("zip_code") String zipCode,
    String city,
    String address,
    BigDecimal latitude,
    BigDecimal longitude,
    @JsonProperty("property_type") String propertyType,
    Map<String, Object> settings
) {

    /**
     * Constructeur de compatibilite (champs minimum requis) — utilise par les
     * tests et les chemins qui n'ont pas la donnee enrichie.
     */
    public ChannexCreatePropertyRequest(String title, String currency, String country,
                                        String timezone, String groupId) {
        this(title, currency, country, timezone, groupId,
            null, null, null, null, null, null, null, null, null);
    }

    /** Construit le payload attendu par Channex (omet les champs optionnels vides). */
    public Map<String, Object> toApiPayload() {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("title", title);
        property.put("currency", currency);
        property.put("country", country);
        property.put("timezone", timezone);
        if (groupId != null && !groupId.isBlank()) {
            property.put("group_id", groupId);
        }
        putIfPresent(property, "email", email);
        putIfPresent(property, "phone", phone);
        putIfPresent(property, "zip_code", zipCode);
        putIfPresent(property, "city", city);
        putIfPresent(property, "address", address);
        if (latitude != null) property.put("latitude", latitude.toPlainString());
        if (longitude != null) property.put("longitude", longitude.toPlainString());
        putIfPresent(property, "property_type", propertyType);
        if (settings != null && !settings.isEmpty()) {
            property.put("settings", settings);
        }
        return Map.of("property", property);
    }

    private static void putIfPresent(Map<String, Object> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value);
        }
    }
}
