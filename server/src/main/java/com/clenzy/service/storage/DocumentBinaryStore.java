package com.clenzy.service.storage;

import org.springframework.core.io.Resource;

/**
 * Strategie de stockage des <b>documents generes</b> (PDF de factures/recus, justificatifs
 * de depenses, pieces jointes) — derriere l'API publique inchangee des services
 * {@code DocumentStorageService}, {@code ReceiptStorageService}, etc.
 *
 * <p><b>Selection par flag</b> {@code clenzy.storage.documents} :</p>
 * <ul>
 *   <li>{@code disk} (defaut, {@code matchIfMissing=true}) → {@link DiskDocumentBinaryStore}
 *       : ecriture/lecture sur le filesystem sous {@code baseDir} (comportement historique,
 *       <b>aucun changement</b>).</li>
 *   <li>{@code object} → {@link ObjectDocumentBinaryStore} : offload vers OVH Object Storage
 *       (S3-compatible) via {@link ObjectStorageClient}, cles org-scopees, lecture par URL
 *       presignee.</li>
 * </ul>
 *
 * <h2>Contrat de cle</h2>
 * Les services appelants construisent une <b>cle logique relative</b> (ex :
 * {@code FACTURE/2026-06/<uuid>_facture.pdf}). La strategie disque la resout sous {@code baseDir} ;
 * la strategie objet la prefixe en {@code org/{orgId}/documents/<cle logique>} et retourne cette
 * cle complete comme reference persistee. Dans les deux cas, la <b>valeur retournee par
 * {@link #write}</b> est la reference a persister en base et a re-fournir aux methodes de lecture.
 */
public interface DocumentBinaryStore {

    /**
     * Persiste des octets sous la cle logique fournie et retourne la <b>reference de stockage</b>
     * a persister en base (chemin relatif disque, ou cle objet org-scopee).
     *
     * @param logicalKey  cle logique relative construite par le service appelant
     *                    (ex : {@code FACTURE/2026-06/<uuid>_nom.pdf})
     * @param data        octets a stocker
     * @param contentType type MIME (ex : {@code application/pdf}) ; peut etre {@code null}
     * @return la reference de stockage (a re-fournir a {@link #loadAsBytes}/{@link #load}/{@link #delete})
     */
    String write(String logicalKey, byte[] data, String contentType);

    /** Charge le contenu en octets a partir de la reference de stockage. */
    byte[] loadAsBytes(String storageRef);

    /** Charge le contenu en streaming a partir de la reference de stockage. */
    Resource load(String storageRef);

    /** Indique si une reference de stockage existe. {@code null}/blanc → {@code false}. */
    boolean exists(String storageRef);

    /** Supprime la reference de stockage (idempotent). {@code null}/blanc → no-op. */
    void delete(String storageRef);
}
