package com.clenzy.booking.dto;

import java.util.List;

/**
 * Résultat d'un import de page externe par URL, destiné à alimenter l'éditeur
 * GrapesJS du Studio (G3). Jamais une entité JPA : record immuable de transport.
 *
 * @param html  corps HTML déjà assaini côté serveur (scripts/iframe/handlers retirés)
 * @param css   feuilles de style agrégées (inline + sheets first-party/CDN), url() absolutisés
 * @param assets liste dédupliquée d'URLs absolues d'assets référencés (images, vidéos, fonts)
 */
public record SiteImportResultDto(
        String html,
        String css,
        List<String> assets
) {}
