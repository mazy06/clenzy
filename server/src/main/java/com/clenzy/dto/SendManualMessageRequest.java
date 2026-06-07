package com.clenzy.dto;

/**
 * Requete d'envoi manuel d'un message a une reservation.
 *
 * @param reservationId reservation cible (obligatoire)
 * @param templateId    template a envoyer (obligatoire)
 * @param channel       canal de diffusion ({@code EMAIL}, {@code WHATSAPP}, {@code SMS}) ;
 *                      {@code null}/inconnu → repli sur {@code EMAIL}
 */
public record SendManualMessageRequest(Long reservationId, Long templateId, String channel) {}
