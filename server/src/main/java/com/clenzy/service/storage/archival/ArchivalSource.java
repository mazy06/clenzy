package com.clenzy.service.storage.archival;

import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * SPI (Service Provider Interface) decrivant <b>QUOI</b> archiver pour une cible donnee.
 *
 * <p>Le moteur {@link ArchivalService} est volontairement <b>generique</b> : il ne connait
 * aucune table, aucune entite, aucune duree de retention. Toute cette connaissance metier est
 * portee par une implementation de cette interface, fournie en code par l'exploitant le jour
 * ou il decide d'activer l'archivage d'un domaine precis (reservations froides, factures NF
 * anciennes, etc.).</p>
 *
 * <p><b>Aucune implementation n'est fournie dans cette phase</b> — c'est intentionnel : sans
 * source enregistree pour une cible, {@link ArchivalService#archive(String)} ne peut rien
 * exporter. Le mecanisme reste donc inerte jusqu'a deux decisions explicites de l'exploitant :
 * activer le flag {@code clenzy.archival.enabled} ET fournir une {@code ArchivalSource}.</p>
 *
 * <h2>Contrat d'implementation</h2>
 * <ul>
 *   <li><b>Lecture seule</b> : {@link #fetchBatch(Pageable)} NE DOIT JAMAIS modifier ou
 *       supprimer de donnees. Le moteur exporte d'abord ; la purge eventuelle est une etape
 *       separee, explicite, non implementee ici.</li>
 *   <li><b>Pagination stable</b> : trier sur une cle stable (ex : {@code id} croissant) pour
 *       que les batchs successifs ne sautent/dupliquent pas de lignes.</li>
 *   <li><b>Lignes serialisables</b> : retourner des records/DTO immuables serialisables en
 *       JSON par Jackson (pas d'entites JPA lazy — risque de {@code LazyInitializationException}
 *       hors session et de fuite de relations).</li>
 * </ul>
 *
 * <p>Le {@code name} retourne par {@link #targetName()} doit matcher un
 * {@code clenzy.archival.targets[].name}. Plusieurs sources ne peuvent pas partager le meme nom.</p>
 */
public interface ArchivalSource {

    /**
     * Identifiant de la cible servie par cette source. Doit correspondre EXACTEMENT a un
     * {@code clenzy.archival.targets[].name} configure.
     */
    String targetName();

    /**
     * Renvoie un batch de lignes a archiver, en <b>lecture seule</b>, pagine. Le moteur appelle
     * cette methode page apres page (page 0, 1, …) jusqu'a recevoir une page vide.
     *
     * @param pageable page demandee (taille fixee par {@code clenzy.archival.batch-size})
     * @return les lignes de la page (records serialisables) ; liste vide = fin de l'export
     */
    List<?> fetchBatch(Pageable pageable);
}
