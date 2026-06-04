package com.clenzy.dto.device;

/**
 * Statut de connexion d'un provider IoT, pour le bandeau « Services reliés » du Hub.
 *
 * connected :
 * - Minut / Tuya / Nuki : connexion org/user reellement active (table *_connections)
 * - KeyNest / KeyVault  : pas de connexion org-level -> base sur la presence d'objets
 */
public record ProviderStatusDto(
        String provider,   // MINUT | TUYA | NUKI | KEYNEST | CLENZY_KEYVAULT
        boolean connected,
        long deviceCount,
        String status      // ACTIVE | NOT_CONNECTED | null (presence-based)
) {
}
