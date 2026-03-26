package com.clenzy.booking.model;

/**
 * Mode de tarification d'un service optionnel du booking engine.
 * <ul>
 *   <li>PER_BOOKING — prix fixe par reservation</li>
 *   <li>PER_PERSON — prix multiplie par le nombre de voyageurs</li>
 *   <li>PER_NIGHT — prix multiplie par le nombre de nuits</li>
 * </ul>
 */
public enum BookingServicePricingMode {
    PER_BOOKING,
    PER_PERSON,
    PER_NIGHT
}
