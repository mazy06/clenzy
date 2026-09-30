package com.clenzy.service.storage;

import com.clenzy.model.InterventionPhoto;

/**
 * Strategie de <b>resolution des octets</b> d'une {@link InterventionPhoto} — derriere l'API
 * inchangee d'{@code InterventionPhotoService}.
 *
 * <p>En mode {@code object}, l'upload ecrit directement l'objet ({@link #store}, hors transaction,
 * regle audit n°2) et seule la cle est enregistree : aucun octet de photo en base. En mode
 * {@code bytea} (developpement), les octets restent dans la colonne {@code data}.</p>
 *
 * <p><b>Selection par flag</b> {@code clenzy.storage.intervention-photos} :</p>
 * <ul>
 *   <li>{@code bytea} (defaut, {@code matchIfMissing=true}) → {@link ByteaInterventionPhotoStore}
 *       : lit la colonne {@code data} (BYTEA). Comportement historique, <b>aucun changement</b>.</li>
 *   <li>{@code object} → {@link ObjectInterventionPhotoStore} : lit l'objet OVH Object Storage
 *       (S3-compatible) via {@link ObjectStorageClient} a partir de la cle org-scopee
 *       {@code org/{orgId}/intervention-photos/{uuid}} ecrite dans {@code storage_key} par le
 *       job de migration. Lecture fail-closed org-scopee.</li>
 * </ul>
 *
 * <h2>Contrat de lecture (CLEF de la bascule)</h2>
 * {@code InterventionPhotoService} resout les octets ainsi : si {@link InterventionPhoto#getStorageKey()}
 * est non-null, il delegue a {@link #resolveBytes(InterventionPhoto)} ; sinon il lit directement le
 * BYTEA ({@code getData()}). Les octets d'une photo non migree (sans {@code storageKey}) ne passent
 * donc jamais par cette strategie.
 */
public interface InterventionPhotoBinaryStore {

    /**
     * Resout les octets d'une photo dont le {@code storageKey} est non-null. L'implementation
     * objet doit valider l'acces org (fail-closed) avant toute lecture, la cle etant
     * potentiellement controlee depuis une ressource chargee par {@code findById}
     * (qui ne traverse pas le filtre Hibernate {@code organizationFilter}).
     *
     * @param photo la photo (avec {@code storageKey} non-null)
     * @return les octets de l'image
     */
    byte[] resolveBytes(InterventionPhoto photo);

    /**
     * Ecrit les octets d'une nouvelle photo et retourne sa cle, ou {@code null} quand ils doivent
     * rester dans la colonne {@code data} (mode {@code bytea}, reserve au developpement). Appele
     * HORS transaction (regle audit n°2) : la cle est ensuite enregistree par une transaction courte.
     *
     * @param organizationId organisation proprietaire (prefixe de la cle)
     */
    String store(long organizationId, byte[] data, String contentType);

    /** Supprime l'objet d'une cle ecrite par {@link #store} (sans effet en mode {@code bytea}). */
    void delete(String storageKey);
}
