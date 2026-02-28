package com.clenzy.integration.channel.dto;

/**
 * Resultat d'un test de connexion a un channel.
 */
public record ChannelConnectionTestResult(
    boolean success,
    String message,
    String channelPropertyName
) {}
