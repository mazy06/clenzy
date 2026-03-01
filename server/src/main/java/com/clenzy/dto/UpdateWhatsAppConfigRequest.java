package com.clenzy.dto;

public record UpdateWhatsAppConfigRequest(
    String apiToken,
    String phoneNumberId,
    String businessAccountId,
    String webhookVerifyToken,
    Boolean enabled
) {}
