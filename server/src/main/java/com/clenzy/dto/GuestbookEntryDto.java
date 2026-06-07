package com.clenzy.dto;

import com.clenzy.model.WelcomeGuideEntry;

import java.time.LocalDateTime;

public record GuestbookEntryDto(
    Long id,
    String authorName,
    String message,
    Integer rating,
    LocalDateTime createdAt
) {
    public static GuestbookEntryDto from(WelcomeGuideEntry e) {
        return new GuestbookEntryDto(
            e.getId(), e.getAuthorName(), e.getMessage(), e.getRating(), e.getCreatedAt());
    }
}
