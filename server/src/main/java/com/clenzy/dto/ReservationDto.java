package com.clenzy.dto;

/**
 * DTO pour les reservations (sejours voyageurs).
 * Utilise en entree (create/update) et en sortie (lecture).
 */
public record ReservationDto(
    Long id,
    Long propertyId,
    String propertyName,
    String guestName,
    Long guestId,
    String guestEmail,
    String guestPhone,
    Integer guestCount,
    String checkIn,
    String checkOut,
    String checkInTime,
    String checkOutTime,
    String status,
    String source,
    String sourceName,
    /** Le canal a-t-il deja encaisse ? Lu, plus deduit du nom du canal. */
    Boolean collectedByChannel,
    Double totalPrice,
    String confirmationCode,
    String notes,
    Double cleaningFee,
    Double touristTaxAmount,
    Boolean createCleaning,
    // Payment link tracking
    String paymentLinkSentAt,
    String paymentLinkEmail,
    Boolean hiddenFromPlanning,
    // Payment status (read-only output)
    String paymentStatus,
    String paidAt,
    // Linked intervention (read-only output)
    Long interventionId,
    // Ventilation adultes/enfants (0314) — input + output. NULL = ventilation
    // inconnue (le calcul de taxe de sejour retombe sur guestCount).
    Integer adultsCount,
    Integer childrenCount
) {

    /**
     * Signature anterieure a l'ajout de {@code collectedByChannel}.
     *
     * <p>Ce record est positionnel et compte une trentaine de composants :
     * inserer un champ obligeait a rouvrir une quinzaine d'appels — surtout des
     * tests — qui ne s'interessent pas au regime d'encaissement. Ce constructeur
     * leur laisse leur forme, avec {@code null} : le champ est une SORTIE de
     * lecture, jamais une entree, et le mapper le renseigne toujours.</p>
     */
    public ReservationDto(Long id, Long propertyId, String propertyName, String guestName,
            Long guestId, String guestEmail, String guestPhone, Integer guestCount,
            String checkIn, String checkOut, String checkInTime, String checkOutTime,
            String status, String source, String sourceName, Double totalPrice,
            String confirmationCode, String notes, Double cleaningFee, Double touristTaxAmount,
            Boolean createCleaning, String paymentLinkSentAt, String paymentLinkEmail,
            Boolean hiddenFromPlanning, String paymentStatus, String paidAt,
            Long interventionId, Integer adultsCount, Integer childrenCount) {
        this(id, propertyId, propertyName, guestName, guestId, guestEmail, guestPhone, guestCount,
             checkIn, checkOut, checkInTime, checkOutTime, status, source, sourceName,
             null, totalPrice, confirmationCode, notes, cleaningFee, touristTaxAmount,
             createCleaning, paymentLinkSentAt, paymentLinkEmail, hiddenFromPlanning,
             paymentStatus, paidAt, interventionId, adultsCount, childrenCount);
    }
}
