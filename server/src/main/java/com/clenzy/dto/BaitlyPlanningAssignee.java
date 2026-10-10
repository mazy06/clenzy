package com.clenzy.dto;

/** Nom déchiffré une seule fois par intervenant distinct dans une fenêtre Baitly. */
public record BaitlyPlanningAssignee(Long id, String firstName, String lastName) {
    public String displayName() {
        return ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
    }
}
