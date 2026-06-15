package com.clenzy.booking.model;

/**
 * Type d'une page de site hébergé. Détermine le rendu côté service SSR :
 * pages dynamiques (liste/détail de propriétés, blog) vs page composée libre.
 */
public enum SitePageType {
    HOME,
    PROPERTY_LIST,
    PROPERTY_DETAIL,
    BLOG,
    CUSTOM
}
