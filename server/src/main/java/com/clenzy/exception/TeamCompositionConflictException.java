package com.clenzy.exception;

public class TeamCompositionConflictException extends IllegalStateException {
    public TeamCompositionConflictException() {
        super("Cette équipe a des missions actives. Réaffectez ou clôturez ces missions avant de modifier ses membres ou de la supprimer.");
    }
}
