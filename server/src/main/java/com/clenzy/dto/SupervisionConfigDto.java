package com.clenzy.dto;

import java.util.List;

/**
 * Config org-level de la constellation Superviseur (master + modules).
 *
 * <p>Sert à la fois en lecture (GET) et en écriture (PUT) ; en écriture, seuls
 * {@code enabled}/{@code paused} et, par module, {@code key}/{@code enabled}/
 * {@code autonomy} sont pris en compte.</p>
 */
public record SupervisionConfigDto(
        boolean enabled,
        boolean paused,
        int dailyScanBudget,
        List<SupervisionModuleDto> modules
) {
}
