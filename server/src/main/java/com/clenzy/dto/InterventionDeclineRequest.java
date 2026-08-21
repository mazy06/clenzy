package com.clenzy.dto;

import jakarta.validation.constraints.Size;

/**
 * Motif de refus d'une mission.
 *
 * <p>Facultatif : obliger a se justifier pour dire « je ne peux pas » ferait
 * refuser en silence, ou pire, accepter puis ne pas venir. Mais quand il est
 * donne, il est conserve — c'est ce qui evite de reproposer la meme mission au
 * meme moment.</p>
 */
public record InterventionDeclineRequest(@Size(max = 500) String reason) {}
