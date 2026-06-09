package com.clenzy.model;

/**
 * Types d'evenements guest captures sur la page publique du livret.
 * Append-only : sert uniquement aux statistiques cote hote (pas de logique metier).
 */
public enum WelcomeGuideEventType {
    /** Ouverture du livret (une fois par session guest). */
    GUIDE_OPENED,
    /** Clic sur une activite (detail = nom de l'activite). */
    ACTIVITY_CLICK,
    /** Message envoye au chatbot du livret. */
    CHAT_MESSAGE,
    /** Avis depose dans le livre d'or. */
    GUESTBOOK_SUBMIT,
    /** Clic sur le lien de check-in en ligne. */
    CHECKIN_CLICK,
    /** Ouverture de la porte depuis le livret (serrure connectée). */
    DOOR_UNLOCK
}
