package com.clenzy.integration.odoo.dto;

import com.clenzy.integration.odoo.model.OdooConnection;

import java.time.Instant;

/**
 * Reponse minimale pour GET /api/odoo/status.
 * Ne expose JAMAIS l'API key, meme chiffree.
 */
public record OdooStatusDto(
        boolean connected,
        String serverUrl,
        String databaseName,
        String userLogin,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static OdooStatusDto notConnected() {
        return new OdooStatusDto(false, null, null, null, null, null, null);
    }

    public static OdooStatusDto fromEntity(OdooConnection c) {
        return new OdooStatusDto(
                c.getStatus() == OdooConnection.Status.ACTIVE,
                c.getServerUrl(),
                c.getDatabaseName(),
                c.getUserLogin(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
