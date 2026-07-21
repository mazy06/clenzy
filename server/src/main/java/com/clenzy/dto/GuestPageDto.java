package com.clenzy.dto;

import java.util.List;

/**
 * Page de voyageurs pour le mode pagine opt-in de la page Voyageurs
 * (enveloppe standard {content, page, size, totalElements}).
 */
public record GuestPageDto(
        List<GuestListDto> content,
        int page,
        int size,
        long totalElements
) {}
