package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.service.ChannexCapabilityService.Capability;
import com.clenzy.integration.channex.service.ChannexCapabilityService.CacheEntry;

import java.util.Map;

/**
 * Snapshot des capacites Channex whitelabel detectees par le circuit-breaker.
 *
 * <p>Expose via {@code GET /api/integrations/channex/capabilities}. Permet
 * a l'admin de voir l'etat actuel du cache d'auto-detection runtime.</p>
 *
 * <p>Pour chaque capability, on retourne :</p>
 * <ul>
 *   <li>{@code available} : true si dispo (ou jamais tente), false si confirme KO</li>
 *   <li>{@code expiresAt} : date d'expiration du cache (null si jamais tente)</li>
 * </ul>
 *
 * @param capabilities map capability → entree de cache
 */
public record ChannexCapabilityReport(
    Map<Capability, CacheEntry> capabilities
) {}
