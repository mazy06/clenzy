package com.clenzy.dto;

import com.clenzy.model.SentimentLabel;

import java.util.Map;

public record ReviewStatsDto(
    Long propertyId,
    Double averageRating,
    long totalReviews,
    Map<Integer, Long> ratingDistribution,
    Map<SentimentLabel, Long> sentimentBreakdown
) {}
