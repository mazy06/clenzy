package com.clenzy.service.storage.offload;

import java.util.List;

/**
 * Une famille de fichiers encore stockés hors du stockage objet (octets en base ou fichier sur le
 * disque du serveur), que {@link InlineBinaryOffloadService} y déplace.
 *
 * <p>Chaque source ne fait que de l'accès aux données : lister les éléments restants, lire un fichier,
 * puis enregistrer sa clé en effaçant l'ancienne copie. L'envoi et la vérification de l'objet, hors
 * transaction, restent au moteur.</p>
 */
public interface InlineBinarySource {

    /** Stockage objet visé. */
    enum Bucket { MEDIA, DOCUMENTS }

    /** Nom de la famille, pour les journaux et le rapport d'administration. */
    String family();

    /** Faux tant que la famille n'est pas basculée sur le stockage objet : elle est alors ignorée. */
    boolean active();

    Bucket bucket();

    /** Identifiants dont le fichier reste à déplacer, supérieurs à {@code afterId}, par ordre croissant. */
    List<Long> pendingIdsAfter(long afterId, int limit);

    /** Le fichier d'un élément, ou {@code null} s'il a disparu ou a déjà été déplacé entre-temps. */
    PendingBinary load(long id);

    /** Clé de l'objet à écrire (une clé déjà choisie par une reprise précédente est réutilisée). */
    String objectKey(PendingBinary binary);

    /**
     * Enregistre la clé et efface l'ancienne copie (octets en base, ligne, ou fichier sur le disque),
     * une fois l'objet écrit et vérifié. Sans effet si l'élément a changé entre-temps.
     *
     * @return {@code true} si l'ancienne copie a été effacée
     */
    boolean complete(long id, PendingBinary binary, String objectKey);
}
