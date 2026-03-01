package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

public record SendConversationMessageRequest(
    @NotBlank String content,
    String contentHtml
) {}
