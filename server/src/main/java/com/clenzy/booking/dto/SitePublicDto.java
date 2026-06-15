package com.clenzy.booking.dto;

import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePage;

import java.util.List;

/**
 * Vue publique d'un site résolu par hostname — consommée par le service SSR « Clenzy Sites » :
 * thème + défauts SEO + table des pages publiées (paths/types). Le contenu d'une page est servi
 * séparément par {@link SitePagePublicDto}.
 */
public record SitePublicDto(
    Long id,
    String slug,
    String name,
    String defaultLocale,
    String locales,
    String designTokens,
    String primaryColor,
    String fontFamily,
    String logoUrl,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl,
    Long bookingEngineConfigId,
    /** Clé publique du booking engine (X-Booking-Key) pour monter le widget de réservation côté SSR. */
    String bookingEngineApiKey,
    /** CSS custom du site (injecté dans le layout SSR + déjà appliqué au widget/SPA). */
    String customCss,
    /** JS custom du site (injecté dans le layout SSR). Code de confiance (config org). */
    String customJs,
    /** Composition de micro-widgets de la barre/flux de réservation (JSON `{widgetLayout,styleMode}`) ; le SDK la rend au montage du widget. */
    String componentConfig,
    List<PageSummary> pages
) {
    /** Entrée de la table des pages (navigation + génération du sitemap côté SSR). */
    public record PageSummary(String path, String type, String title, String locale, int sortOrder) {
        static PageSummary from(SitePage p) {
            return new PageSummary(p.getPath(),
                p.getType() != null ? p.getType().name() : null,
                p.getTitle(), p.getLocale(), p.getSortOrder());
        }
    }

    public static SitePublicDto from(Site s, String bookingEngineApiKey, String customCss, String customJs,
                                     String componentConfig, List<SitePage> pages) {
        return new SitePublicDto(
            s.getId(), s.getSlug(), s.getName(), s.getDefaultLocale(), s.getLocales(),
            s.getDesignTokens(), s.getPrimaryColor(), s.getFontFamily(), s.getLogoUrl(),
            s.getSeoTitle(), s.getSeoDescription(), s.getSeoOgImageUrl(), s.getBookingEngineConfigId(),
            bookingEngineApiKey, customCss, customJs, componentConfig,
            pages.stream().map(PageSummary::from).toList());
    }
}
