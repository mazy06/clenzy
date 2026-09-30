package com.clenzy.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collection;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Deux garde-fous communs aux fichiers envoyés vers le stockage objet (règle audit n°2 : jamais
 * d'appel réseau dans une transaction de base de données).
 *
 * <ul>
 *   <li>À l'envoi, l'objet est écrit <b>avant</b> la transaction qui enregistre sa clé. Si cette
 *       transaction échoue, {@link #persistOrDiscard} supprime les objets déjà écrits : sans cela,
 *       ils resteraient orphelins sur le stockage.</li>
 *   <li>À la suppression, l'objet n'est détruit qu'<b>après</b> la validation de la transaction qui
 *       efface la ligne ({@link #afterCommit}) : une transaction annulée ne laisse pas une ligne
 *       pointer vers un objet disparu.</li>
 * </ul>
 */
public final class ObjectStorageTransactions {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorageTransactions.class);

    private ObjectStorageTransactions() {
    }

    /**
     * Exécute {@code persist} ; en cas d'échec, supprime les objets {@code writtenKeys} déjà écrits,
     * puis relance l'exception d'origine.
     *
     * <p>L'échec d'une suppression de nettoyage ne masque jamais l'erreur d'origine : il est journalisé
     * en erreur avec la clé, pour que l'objet orphelin puisse être retrouvé.</p>
     */
    public static <T> T persistOrDiscard(Collection<String> writtenKeys,
                                         Consumer<String> discard,
                                         Supplier<T> persist) {
        try {
            return persist.get();
        } catch (RuntimeException e) {
            discard(writtenKeys, discard);
            throw e;
        }
    }

    /**
     * Supprime des objets écrits qui ne seront pas enregistrés. Chaque échec est journalisé en
     * erreur avec la clé (objet orphelin à retrouver) et n'interrompt pas les suppressions suivantes :
     * l'appelant relance ensuite sa propre erreur, qui ne doit pas être masquée.
     */
    public static void discard(Collection<String> writtenKeys, Consumer<String> discard) {
        for (String key : writtenKeys) {
            if (key == null) {
                continue;
            }
            try {
                discard.accept(key);
            } catch (RuntimeException cleanupFailure) {
                log.error("Objet orphelin à supprimer du stockage : key={} ({})",
                        key, cleanupFailure.getMessage(), cleanupFailure);
            }
        }
    }

    /**
     * Exécute {@code action} après la validation de la transaction courante, ou immédiatement s'il
     * n'y en a pas. Un échec est journalisé en erreur (l'objet reste orphelin, la ligne est déjà
     * supprimée) : l'appelant ne peut plus rien annuler à ce stade.
     */
    public static void afterCommit(String description, Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            runLogged(description, action);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                runLogged(description, action);
            }
        });
    }

    private static void runLogged(String description, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            log.error("Échec après validation ({}) : {}", description, e.getMessage(), e);
        }
    }
}
