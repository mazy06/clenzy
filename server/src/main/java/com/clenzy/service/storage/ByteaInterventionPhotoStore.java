package com.clenzy.service.storage;

import com.clenzy.model.InterventionPhoto;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Strategie BYTEA (defaut) de {@link InterventionPhotoBinaryStore} : les octets vivent dans
 * la colonne {@code data} de {@code intervention_photos}. Comportement historique, aucun
 * stockage objet, aucune connexion externe.
 *
 * <p>Activee par defaut ({@code matchIfMissing=true}) ou explicitement via
 * {@code clenzy.storage.intervention-photos=bytea}.</p>
 */
@Component
@ConditionalOnProperty(
        name = "clenzy.storage.intervention-photos",
        havingValue = "bytea",
        matchIfMissing = true)
public class ByteaInterventionPhotoStore implements InterventionPhotoBinaryStore {

    /**
     * En mode BYTEA, une photo a un {@code storageKey} uniquement si elle a ete migree puis
     * que le flag a ete repasse a {@code bytea}. On relit alors le BYTEA (conserve, migration
     * non-destructive) ; absent → echec explicite (l'objet n'est pas accessible sans le flag
     * {@code object}).
     */
    @Override
    public byte[] resolveBytes(InterventionPhoto photo) {
        final byte[] data = photo.getData();
        if (data != null) {
            return data;
        }
        throw new IllegalStateException(
                "Photo d'intervention id=" + photo.getId() + " a un storageKey mais le flag "
                        + "clenzy.storage.intervention-photos vaut bytea (octets non resolvables). "
                        + "Repasser le flag a object pour relire l'objet.");
    }
}
