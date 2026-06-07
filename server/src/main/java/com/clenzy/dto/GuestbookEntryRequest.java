package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GuestbookEntryRequest(
    @NotBlank @Size(max = 200) String authorName,
    @NotBlank @Size(max = 2000) String message,
    Integer rating
) {}
