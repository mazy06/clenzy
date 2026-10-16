package com.clenzy.dto;

/** Rattachement explicite, sans charger la réservation. */
public record BaitlyPlanningInterventionLink(Long interventionId, Long reservationId) {}
