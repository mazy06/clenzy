package com.clenzy.dto;

import java.util.List;

/**
 * Page de notifications pour le mode pagine opt-in de GET /api/notifications
 * (enveloppe standard {content, page, size, totalElements}).
 */
public record NotificationPageDto(
        List<NotificationDto> content,
        int page,
        int size,
        long totalElements
) {}
