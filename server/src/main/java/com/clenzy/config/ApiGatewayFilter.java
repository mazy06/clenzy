package com.clenzy.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Filtre API Gateway applique a toutes les requetes HTTP entrantes.
 *
 * Responsabilites :
 * - Genere un identifiant de correlation unique (X-Request-Id) pour le tracing distribue
 * - Injecte le requestId dans le MDC (Mapped Diagnostic Context) pour la correlation des logs
 * - Mesure la duree de traitement de chaque requete
 * - Ajoute les headers de reponse : X-Request-Id et X-Response-Time
 * - Log les requetes avec methode, URI, status HTTP et duree
 * - Emet un WARN pour les requetes lentes (> 2000ms)
 *
 * Exclut les endpoints health/actuator et les ressources statiques du logging.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiGatewayFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiGatewayFilter.class);

    /** Seuil en millisecondes au-dela duquel une requete est consideree comme lente */
    private static final long SLOW_REQUEST_THRESHOLD_MS = 2000;

    /** Cle MDC pour l'identifiant de correlation */
    private static final String MDC_REQUEST_ID_KEY = "requestId";

    /** Header HTTP pour l'identifiant de correlation */
    private static final String HEADER_REQUEST_ID = "X-Request-Id";

    /** Header HTTP pour le temps de reponse */
    private static final String HEADER_RESPONSE_TIME = "X-Response-Time";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // Generer ou recuperer l'identifiant de correlation
        String requestId = request.getHeader(HEADER_REQUEST_ID);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        // Injecter le requestId dans le MDC pour la correlation des logs
        MDC.put(MDC_REQUEST_ID_KEY, requestId);

        // Marquer le debut du traitement
        long startTime = System.nanoTime();

        try {
            // Propager le requestId dans les headers de reponse
            response.setHeader(HEADER_REQUEST_ID, requestId);

            // Executer la chaine de filtres
            filterChain.doFilter(request, response);
        } finally {
            // Calculer la duree du traitement
            long durationMs = (System.nanoTime() - startTime) / 1_000_000;

            // Ajouter le header de temps de reponse
            response.setHeader(HEADER_RESPONSE_TIME, durationMs + "ms");

            // Logger la requete si ce n'est pas un endpoint exclu
            String uri = request.getRequestURI();
            if (!isExcludedFromLogging(uri)) {
                String method = request.getMethod();
                int status = response.getStatus();

                if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
                    log.warn("SLOW REQUEST | {} {} | status={} | duration={}ms | requestId={}",
                            method, uri, status, durationMs, requestId);
                } else {
                    log.info("API | {} {} | status={} | duration={}ms | requestId={}",
                            method, uri, status, durationMs, requestId);
                }
            }

            // Nettoyage du MDC pour eviter les fuites entre threads
            MDC.remove(MDC_REQUEST_ID_KEY);
        }
    }

    /**
     * Exclut les ressources statiques du filtre.
     * Les endpoints health/actuator sont toujours traites mais pas logges (voir isExcludedFromLogging).
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return isStaticResource(path);
    }

    /**
     * Determine si un chemin correspond a une ressource statique.
     * Ces requetes ne passent pas du tout par le filtre.
     */
    private boolean isStaticResource(String path) {
        return path.startsWith("/static/")
                || path.startsWith("/assets/")
                || path.startsWith("/favicon")
                || path.endsWith(".css")
                || path.endsWith(".js")
                || path.endsWith(".png")
                || path.endsWith(".jpg")
                || path.endsWith(".gif")
                || path.endsWith(".svg")
                || path.endsWith(".ico")
                || path.endsWith(".woff")
                || path.endsWith(".woff2")
                || path.endsWith(".ttf");
    }

    /**
     * Determine si un endpoint est exclu du logging (mais le filtre s'applique quand meme
     * pour ajouter les headers X-Request-Id et X-Response-Time).
     *
     * Endpoints exclus du logging :
     * - /actuator/** (health checks, metriques Prometheus)
     * - /api/health (health check applicatif)
     */
    private boolean isExcludedFromLogging(String uri) {
        return uri.startsWith("/actuator")
                || uri.equals("/api/health");
    }
}
