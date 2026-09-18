package com.clenzy.exception;

/** Un prestataire ou son équipe ne peut pas être attribué sur ce créneau. */
public class AssignmentConflictException extends IllegalStateException {
    public AssignmentConflictException() {
        super("Le prestataire est déjà réservé sur ce créneau. Choisissez un autre créneau ou prestataire.");
    }

    public AssignmentConflictException(String message) {
        super(message);
    }
}
