package com.clenzy.dto;

/** Nom déchiffré une fois par personne distincte dans une lecture Baitly. */
public record BaitlyPlanningPersonName(Long id, String firstName, String lastName) {
    public String displayName() {
        return ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
    }
}
