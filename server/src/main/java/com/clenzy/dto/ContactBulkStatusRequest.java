package com.clenzy.dto;

import java.util.List;

/**
 * Requete de mise a jour de statut en lot.
 */
public record ContactBulkStatusRequest(
        List<Long> ids,
        String status
) {}
