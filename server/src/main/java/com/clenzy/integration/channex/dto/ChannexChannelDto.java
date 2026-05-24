package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Representation minimale d'un Channel Channex retournee par POST/GET /channels.
 *
 * <p>On ne lit que les champs critiques pour Clenzy : id (pour deep-linker
 * dans l'iframe), title, channel (nom OTA), isActive (true apres OAuth reussi).
 * Les structures complexes ({@code properties}, {@code rate_plans},
 * {@code known_mappings}, {@code settings}, {@code actions}) sont ignorees ici —
 * elles sont gerees cote Channex via l'iframe de mapping.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexChannelDto(
    String id,
    String title,
    @JsonProperty("channel") String channelName,
    @JsonProperty("is_active") Boolean isActive
) {}
