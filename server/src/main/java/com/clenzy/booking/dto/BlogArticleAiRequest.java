package com.clenzy.booking.dto;

/** Requête de génération d'article de blog par IA (2.13) : sujet libre + locale cible optionnelle. */
public record BlogArticleAiRequest(String topic, String locale) {}
