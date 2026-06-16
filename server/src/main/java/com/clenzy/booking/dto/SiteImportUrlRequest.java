package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Corps d'un import de page externe par URL (Studio G3). */
public record SiteImportUrlRequest(
    @NotBlank @Size(max = 2048) String url
) {}
