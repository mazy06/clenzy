package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Reponse enrichie de {@code GET /api/integrations/channex/discover}.
 *
 * <p>Permet au frontend de distinguer 3 etats UX :</p>
 * <ol>
 *   <li><b>Hub vide</b> ({@code totalInHub == 0}) : l'utilisateur n'a aucune
 *       propriete cote hub de distribution. Doit d'abord connecter un OTA
 *       (Airbnb / Booking) via une property Clenzy.</li>
 *   <li><b>Tout deja importe</b> ({@code totalInHub > 0 && items.isEmpty()}) :
 *       toutes les proprietes en ligne sont deja mappees a Clenzy. Rien a faire.</li>
 *   <li><b>Listings a importer</b> ({@code items.size() > 0}) : afficher la
 *       liste avec checkboxes pour selection.</li>
 * </ol>
 *
 * @param items          properties Channex non encore mappees a Clenzy
 * @param totalInHub     nombre total de properties dans le hub (incluant celles deja mappees)
 * @param totalUnmapped  size de {@code items} (redondant mais explicite cote API)
 */
public record ChannexDiscoveryResponse(
    List<ChannexDiscoveredProperty> items,
    int totalInHub,
    int totalUnmapped
) {
    public static ChannexDiscoveryResponse of(List<ChannexDiscoveredProperty> items, int totalInHub) {
        // totalUnmapped = items qui n'ont pas encore de mapping Clenzy (isImported=false)
        int unmapped = (int) items.stream().filter(p -> !p.isImported()).count();
        return new ChannexDiscoveryResponse(items, totalInHub, unmapped);
    }
}
