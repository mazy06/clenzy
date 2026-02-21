package com.clenzy.model;

/**
 * Type de commande calendrier (write-ahead log).
 * Chaque mutation du calendrier est loggee avec son type.
 */
public enum CalendarCommandType {

    /** Reserver des dates (lie a une reservation) */
    BOOK,

    /** Annuler une reservation (liberer les jours) */
    CANCEL,

    /** Bloquer des dates (sans reservation) */
    BLOCK,

    /** Debloquer des dates precedemment bloquees */
    UNBLOCK,

    /** Mettre a jour le prix par nuit sur une plage */
    UPDATE_PRICE
}
