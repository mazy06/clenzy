package com.clenzy.dto;

/** Coordonnées nécessaires au planning, lues une fois par voyageur autorisé. */
public record BaitlyPlanningGuestContact(Long id, String email, String phone, String avatarKey) {}
