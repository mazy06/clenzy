package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateReviewRequest(
    @NotNull Long propertyId,
    Long reservationId,
    @NotNull ChannelName channelName,
    String guestName,
    @NotNull @Min(1) @Max(5) Integer rating,
    String reviewText,
    @NotNull LocalDate reviewDate,
    String language
) {}
