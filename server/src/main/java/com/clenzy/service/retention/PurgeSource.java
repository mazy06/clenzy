package com.clenzy.service.retention;

import java.time.Instant;

/**
 * SPI (Service Provider Interface) decrivant <b>QUOI</b> purger pour une cible donnee.
 *
 * <p>Le moteur {@link RetentionPurgeService} est volontairement <b>generique</b> : il ne connait
 * aucune table, aucune entite, aucune duree de retention. Toute cette connaissance metier est
 * portee par une implementation de cette interface, fournie en code par l'exploitant le jour ou il
 * decide d'activer la purge d'un domaine precis (fiche de police a 6 mois, preuve de paiement,
 * PII non probante, etc.).</p>
 *
 * <p><b>Aucune implementation n'est fournie dans cette phase</b> — c'est le <b>2e verrou
 * d'inertie</b> (le 1er etant {@code clenzy.retention.purge.enabled=false}, le 3e
 * {@code dry-run-default=true}). Sans source enregistree pour une cible,
 * {@link RetentionPurgeService#purge(String, Boolean)} ne peut RIEN supprimer (no-op
 * {@code no-source-registered}). Le mecanisme reste donc totalement inerte tant que l'exploitant
 * n'a pas pris trois decisions explicites : activer {@code enabled}, fournir une {@code PurgeSource},
 * et passer {@code dryRun=false}.</p>
 *
 * <h2>Contrat d'implementation (suppression = irreversible, donc strict)</h2>
 * <ul>
 *   <li><b>Borne par le cutoff</b> : ne supprimer QUE les enregistrements dont l'horodatage de
 *       reference (date de creation / d'expiration metier) est {@code <= cutoff}. Le cutoff est
 *       calcule par le moteur ({@code now - retentionDays}) — l'implementation ne decide pas de
 *       la duree.</li>
 *   <li><b>Borne par batch</b> : {@link #deleteExpiredBatch(Instant, int)} DOIT supprimer
 *       <b>au plus</b> {@code limit} enregistrements et s'executer dans une <b>transaction
 *       propre par batch</b> (jamais une seule grosse transaction sur toute la cible) — un
 *       {@code DELETE ... WHERE ... ORDER BY id LIMIT :limit} ou equivalent. La transaction
 *       courte borne la duree des verrous et permet une progression incrementale interruptible.</li>
 *   <li><b>Tri stable</b> : trier sur une cle stable (ex : {@code id} croissant) pour une
 *       progression deterministe et reproductible d'un batch a l'autre.</li>
 *   <li><b>Idempotent / repetable</b> : re-jouer la purge avec le meme cutoff ne doit JAMAIS
 *       casser ni sur-supprimer ; un batch qui ne trouve plus rien renvoie {@code 0} (signal de
 *       fin pour le moteur).</li>
 *   <li><b>Lecture seule pour {@link #countExpired(Instant)}</b> : utilisee en mode dry-run, elle
 *       NE DOIT JAMAIS modifier ou supprimer de donnees — elle compte seulement les candidats.</li>
 * </ul>
 *
 * <p>Le {@code name} retourne par {@link #targetName()} doit matcher un
 * {@code clenzy.retention.purge.targets[].name}. Deux sources ne peuvent pas partager le meme nom.</p>
 */
public interface PurgeSource {

    /**
     * Identifiant de la cible servie par cette source. Doit correspondre EXACTEMENT a un
     * {@code clenzy.retention.purge.targets[].name} configure.
     */
    String targetName();

    /**
     * Compte, en <b>lecture seule</b>, le nombre d'enregistrements purgeables : ceux dont
     * l'horodatage de reference est {@code <= cutoff}. Appele en mode dry-run pour estimer le
     * volume SANS rien supprimer.
     *
     * @param cutoff borne haute (incluse) calculee par le moteur ({@code now - retentionDays})
     * @return nombre de candidats a la purge (≥ 0)
     */
    long countExpired(Instant cutoff);

    /**
     * Supprime <b>au plus</b> {@code limit} enregistrements dont l'horodatage de reference est
     * {@code <= cutoff}, dans une <b>transaction propre par batch</b>, en tri stable.
     *
     * <p>Le moteur appelle cette methode en boucle jusqu'a obtenir {@code 0} (plus rien a purger).
     * Chaque appel DOIT etre borne par {@code limit} (jamais de suppression non bornee) et
     * transactionnel : un echec en cours de batch laisse les batchs precedents commit et le batch
     * courant rollback — la purge reprendra proprement au prochain appel (idempotence).</p>
     *
     * @param cutoff borne haute (incluse) calculee par le moteur
     * @param limit  nombre maximum d'enregistrements a supprimer dans ce batch
     * @return nombre d'enregistrements reellement supprimes dans ce batch (entre 0 et {@code limit})
     */
    int deleteExpiredBatch(Instant cutoff, int limit);
}
