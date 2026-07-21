package com.clenzy.dto;

/**
 * Élément nommé d'un graphique de l'écran Rapports Baitly : compteur
 * (répartition par statut/type/priorité) ou montant arrondi en euros
 * (ventilation des coûts). La couleur reste une affaire de présentation,
 * assignée côté client.
 */
public record ReportChartItemDto(String name, long value) {}
