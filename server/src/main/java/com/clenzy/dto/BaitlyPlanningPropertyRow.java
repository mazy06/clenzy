package com.clenzy.dto;

import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.PropertyType;
import java.math.BigDecimal;
import java.util.List;

/** Navigation du planning Baitly : uniquement les champs consommés par la grille. */
public record BaitlyPlanningPropertyRow(
        Long id, String name, String address, String city, String ownerName,
        Integer maxGuests, PropertyType type, BigDecimal nightlyPrice, Integer minimumNights,
        String defaultCheckInTime, String defaultCheckOutTime, CleaningFrequency cleaningFrequency,
        BigDecimal cleaningBasePrice, String currency, BigDecimal latitude, BigDecimal longitude,
        List<String> photoUrls) {}
