package com.clenzy.dto;

/**
 * Traduction à la volée du dernier message voyageur d'une conversation (CLZ Domaine 6).
 *
 * @param targetLanguage langue cible demandée
 * @param translatedText texte traduit (= texte original si la traduction n'est pas configurée)
 */
public record ConversationTranslationDto(String targetLanguage, String translatedText) {
}
