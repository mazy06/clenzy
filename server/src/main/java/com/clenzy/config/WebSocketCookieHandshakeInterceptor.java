package com.clenzy.config;

import jakarta.servlet.http.Cookie;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Recupere le jeton du cookie de session lors de la poignee de main WebSocket.
 *
 * <p>Le SPA n'a PAS acces au jeton : {@code AuthSessionController} refuse
 * deliberement de l'exposer au JavaScript (Z1-SEC-FRONTAUX-02) et le cookie
 * {@code clenzy_auth} est HttpOnly. Le client ne pouvait donc pas poser le
 * header {@code Authorization} sur la trame CONNECT, et toute connexion STOMP
 * etait rejetee — quel que soit le soin apporte au code du client.</p>
 *
 * <p>La poignee de main, elle, est une requete HTTP ordinaire : le navigateur y
 * joint le cookie. On se contente d'en extraire le jeton BRUT et de le deposer
 * dans les attributs de session. {@link WebSocketAuthInterceptor} le valide
 * ensuite exactement comme celui d'un header — meme {@code JwtDecoder}, meme
 * rejet en cas d'echec. Cette classe ajoute une SOURCE, jamais une decision de
 * confiance : un cookie invalide est refuse comme un header invalide.</p>
 */
@Component
public class WebSocketCookieHandshakeInterceptor implements HandshakeInterceptor {

    /** Cle du jeton brut dans les attributs de session WebSocket. */
    public static final String SESSION_ATTR_COOKIE_TOKEN = "clenzy.ws.cookieToken";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            Cookie[] cookies = servletRequest.getServletRequest().getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if (TokenCookieFilter.COOKIE_NAME.equals(cookie.getName())
                            && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                        attributes.put(SESSION_ATTR_COOKIE_TOKEN, cookie.getValue());
                        break;
                    }
                }
            }
        }
        // La poignee de main n'authentifie RIEN par elle-meme : elle aboutit
        // toujours, et c'est la trame CONNECT qui accepte ou refuse.
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // Rien a faire.
    }
}
