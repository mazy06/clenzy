package com.clenzy.exception;

/**
 * Une regle de cycle de vie refuse l'action demandee (transition interdite, demarrage avant la
 * date prevue) : reponse 409 attendue par le client, et non une erreur serveur.
 *
 * <p>Reste une {@link IllegalStateException} pour les appelants qui la traitent deja ainsi.</p>
 */
public class InterventionStateConflictException extends IllegalStateException {
    public InterventionStateConflictException(String message) {
        super(message);
    }
}
