package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Message d'un voyageur au chatbot du livret. */
public record GuestChatRequest(
    @NotBlank @Size(max = 1000) String message
) {}
