package com.clenzy.booking.security;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * Filtre de securite pour l'API publique du Booking Engine.
 *
 * Valide l'API Key envoyee dans le header X-Booking-Key.
 * Si valide, verifie que le Booking Engine est active pour l'organisation.
 *
 * <p><b>Controle d'origine (Z4A-SEC-04)</b> : l'API Key est posee par le JS du
 * widget embarque, donc visible publiquement — elle ne vaut pas secret. La
 * vraie barriere est la liste {@code allowedOrigins} de l'organisation :
 * l'Origin (ou a defaut le Referer) de chaque requete est verifie contre cette
 * liste. En production, une cle SANS origine configuree refuse toute requete
 * cross-site (deny by default) ; le mode permissif n'existe qu'en dev.</p>
 *
 * Ce filtre s'applique uniquement aux requetes /api/public/booking/**.
 * Il est ajoute AVANT la chaine Spring Security standard (pas de JWT requis).
 */
@Component
public class BookingApiKeyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(BookingApiKeyFilter.class);

    private static final String BOOKING_PATH_PREFIX = "/api/public/booking/";
    private static final String API_KEY_HEADER = "X-Booking-Key";

    private final BookingEngineConfigRepository configRepository;
    private final ObjectMapper objectMapper;
    private final boolean strictOriginMode;

    public BookingApiKeyFilter(BookingEngineConfigRepository configRepository,
                                ObjectMapper objectMapper,
                                Environment environment) {
        this.configRepository = configRepository;
        this.objectMapper = objectMapper;
        // Deny by default en production quand allowedOrigins n'est pas configure ;
        // en dev/test le comportement permissif historique est conserve.
        this.strictOriginMode = environment.acceptsProfiles(Profiles.of("prod"));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith(BOOKING_PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        // Preflight CORS — laisser passer sans API Key
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String apiKey = request.getHeader(API_KEY_HEADER);

        if (apiKey == null || apiKey.isBlank()) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED,
                "Header " + API_KEY_HEADER + " manquant");
            return;
        }

        Optional<BookingEngineConfig> configOpt = configRepository.findByApiKey(apiKey);
        if (configOpt.isEmpty()) {
            log.warn("Booking API Key invalide : {}...", apiKey.length() > 10 ? apiKey.substring(0, 10) : apiKey);
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "API Key invalide");
            return;
        }

        BookingEngineConfig config = configOpt.get();
        if (!config.isEnabled()) {
            sendError(response, HttpServletResponse.SC_FORBIDDEN,
                "Booking Engine desactive pour cette organisation");
            return;
        }

        // Validation d'origine — Origin si present, sinon Referer (Z4A-SEC-04).
        String origin = request.getHeader("Origin");
        boolean hasOrigin = origin != null && !origin.isBlank();
        String effectiveOrigin = hasOrigin ? origin : extractOriginFromReferer(request.getHeader("Referer"));

        if (effectiveOrigin != null) {
            if (!isOriginAllowed(config, effectiveOrigin)) {
                log.warn("Booking Engine — Origin non autorise : {} (org {})",
                    effectiveOrigin, config.getOrganizationId());
                sendError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Origine non autorisee");
                return;
            }
            if (hasOrigin) {
                // Ajouter les headers CORS dynamiques
                response.setHeader("Access-Control-Allow-Origin", origin);
                response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.setHeader("Access-Control-Allow-Headers",
                    "Content-Type, " + API_KEY_HEADER);
                response.setHeader("Access-Control-Max-Age", "3600");
                response.setHeader("Vary", "Origin");
            }
        }

        // Stocker l'orgId dans les attributs de la requete pour usage downstream
        request.setAttribute("bookingOrgId", config.getOrganizationId());
        request.setAttribute("bookingConfig", config);

        filterChain.doFilter(request, response);
    }

    /**
     * Verifie si l'origine est autorisee par la configuration de l'organisation.
     * Les origines sont stockees en CSV dans allowedOrigins.
     *
     * <p>Si allowedOrigins est null/vide : refus en production (la cle etant
     * visible cote client, accepter toute origine reviendrait a un acces public
     * total — Z4A-SEC-04) ; acceptation en dev uniquement.</p>
     */
    private boolean isOriginAllowed(BookingEngineConfig config, String origin) {
        String allowedOrigins = config.getAllowedOrigins();
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            if (strictOriginMode) {
                log.warn("Booking Engine — aucune origine configuree pour l'org {} : "
                    + "requete cross-site refusee (configurer allowedOrigins)",
                    config.getOrganizationId());
                return false;
            }
            // Mode dev uniquement — pas de restriction
            return true;
        }

        String normalizedOrigin = origin.toLowerCase().replaceAll("/$", "");
        for (String allowed : allowedOrigins.split(",")) {
            String normalizedAllowed = allowed.trim().toLowerCase().replaceAll("/$", "");
            if (normalizedAllowed.equals(normalizedOrigin)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Extrait l'origine (scheme://host[:port]) du header Referer.
     * Retourne null si absent ou illisible (requete server-to-server : la
     * verification d'origine n'est alors pas applicable).
     */
    private String extractOriginFromReferer(String referer) {
        if (referer == null || referer.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(referer.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return null;
            }
            return uri.getPort() > 0
                ? uri.getScheme() + "://" + uri.getHost() + ":" + uri.getPort()
                : uri.getScheme() + "://" + uri.getHost();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), Map.of("error", message));
    }
}
