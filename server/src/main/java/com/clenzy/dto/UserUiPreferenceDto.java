package com.clenzy.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Une preference UI (key-value).
 * La valeur est un {@link JsonNode} arbitraire (objet, tableau, primitive)
 * — le shape est garanti par le frontend (TypeScript).
 */
public record UserUiPreferenceDto(String key, JsonNode value) {
}
