package com.clenzy.booking.model;

/**
 * Type d'input pour un service optionnel du booking engine.
 * <ul>
 *   <li>QUANTITY — champ numerique (ex: 2 planches aperitives)</li>
 *   <li>CHECKBOX — selection binaire (oui/non)</li>
 * </ul>
 */
public enum BookingServiceInputType {
    QUANTITY,
    CHECKBOX
}
