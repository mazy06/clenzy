package com.clenzy.dto;

import com.clenzy.model.CustomServiceType;

/** Type de service personnalisé exposé à l'API. */
public record CustomServiceTypeDto(Long id, String category, String label) {

    public static CustomServiceTypeDto from(CustomServiceType e) {
        return new CustomServiceTypeDto(e.getId(), e.getCategory(), e.getLabel());
    }
}
