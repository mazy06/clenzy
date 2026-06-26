package com.clenzy.service.storage;

import com.clenzy.model.InterventionPhoto;

/**
 * Strategie de <b>resolution des octets</b> d'une {@link InterventionPhoto} — derriere l'API
 * inchangee d'{@code InterventionPhotoService}.
 *
 * <p>Modele <b>identique a celui des photos de propriete</b> ({@code PhotoStorageService} /
 * {@code PropertyPhotoService}) : l'<b>upload ecrit toujours le BYTEA</b> (colonne {@code data}),
 * quel que soit le flag — aucun appel objet a l'upload (donc aucun IO reseau dans la transaction
 * d'upload, regle audit #2). Le flag ne change que la <b>lecture</b> :</p>
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
}
