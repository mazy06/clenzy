package com.clenzy.integration.channel.dto;

import com.clenzy.integration.channel.ChannelName;

import java.time.LocalDateTime;

/**
 * DTO representant le statut de connexion d'un channel pour une organisation.
 */
public record ChannelConnectionDto(
    Long id,
    ChannelName channel,
    String status,
    boolean connected,
    LocalDateTime connectedAt,
    LocalDateTime lastSyncAt,
    String lastError,
    String externalPropertyId
) {}
