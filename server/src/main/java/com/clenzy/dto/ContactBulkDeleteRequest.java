package com.clenzy.dto;

import java.util.List;

/**
 * Requete de suppression en lot.
 */
public record ContactBulkDeleteRequest(
        List<Long> ids
) {}
