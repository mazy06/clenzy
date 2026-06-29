package com.clenzy.booking.model;

/**
 * Source de données des widgets d'un booking engine.
 *
 * <ul>
 *   <li>{@link #REAL} : vraies données du tenant (propriétés, prix, disponibilités en base).</li>
 *   <li>{@link #MOCK} : jeu de démo générique servi par les widgets — aucune vraie donnée,
 *       et <b>aucune réservation ni paiement réel</b> (parcours simulé). Pour démo / prévisualisation
 *       / avant mise en production.</li>
 * </ul>
 */
public enum DataSourceMode {
    REAL,
    MOCK
}
