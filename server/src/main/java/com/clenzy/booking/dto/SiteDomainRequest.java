package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Corps d'ajout d'un domaine custom à un site. */
public record SiteDomainRequest(
    @NotBlank @Size(max = 253) String hostname,
    boolean primary
) {}
