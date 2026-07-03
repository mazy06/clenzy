package com.clenzy.dto.yield;

/**
 * Config yield v1 de l'org : kill-switch + mode progressif (SIMULATION / SUGGEST / AUTO).
 */
public record YieldConfigDto(
    boolean enabled,
    String mode
) {}
