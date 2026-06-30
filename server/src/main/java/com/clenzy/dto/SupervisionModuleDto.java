package com.clenzy.dto;

/**
 * Config d'un module (agent) de la constellation, exposée au front.
 *
 * @param key      clé du module (ex. {@code com})
 * @param labelKey clé i18n du libellé (rendu côté front) — ignoré en écriture
 * @param enabled  module actif pour l'org
 * @param autonomy niveau d'autonomie réseau ('suggest'|'notify'|'full')
 * @param builtin  module natif (vs importé) — ignoré en écriture
 */
public record SupervisionModuleDto(
        String key,
        String labelKey,
        boolean enabled,
        String autonomy,
        boolean builtin
) {
}
