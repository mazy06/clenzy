package com.clenzy.integration.regulatory.ntmp;

import java.time.Instant;

/**
 * Jeton d'acces a la passerelle NTMP, avec son echeance ABSOLUE.
 *
 * <p>La passerelle repond une duree relative ({@code expires_in}) ; on la fige
 * en instant des la reception. Garder la duree obligerait chaque lecteur a
 * savoir quand elle a ete obtenue — une information qui se perd.</p>
 */
public record NtmpAccessToken(String value, Instant expiresAt) {
}
