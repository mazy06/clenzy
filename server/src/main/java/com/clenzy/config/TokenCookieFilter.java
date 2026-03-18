package com.clenzy.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

/**
 * Filtre qui lit le token JWT depuis un cookie HttpOnly et l'injecte
 * comme header Authorization pour le BearerTokenAuthenticationFilter.
 *
 * Ordre d'execution : AVANT BearerTokenAuthenticationFilter.
 * Si le header Authorization est deja present (appels legacy), le cookie est ignore.
 * Cela permet une migration progressive du localStorage vers les cookies HttpOnly.
 */
public class TokenCookieFilter extends OncePerRequestFilter {

    public static final String COOKIE_NAME = "clenzy_auth";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        // Si le header Authorization est deja present, ne pas le surcharger
        if (request.getHeader("Authorization") != null) {
            filterChain.doFilter(request, response);
            return;
        }

        // Chercher le cookie HttpOnly
        String token = extractTokenFromCookie(request);
        if (token != null) {
            // Wrapper la requete pour injecter le header Authorization
            filterChain.doFilter(new AuthorizationHeaderWrapper(request, "Bearer " + token), response);
        } else {
            filterChain.doFilter(request, response);
        }
    }

    private String extractTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;

        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value != null && !value.isBlank()) ? value : null;
            }
        }
        return null;
    }

    /**
     * Wrapper qui injecte le header Authorization dans la requete
     * sans modifier la requete originale.
     */
    private static class AuthorizationHeaderWrapper extends HttpServletRequestWrapper {

        private final String authorizationValue;

        AuthorizationHeaderWrapper(HttpServletRequest request, String authorizationValue) {
            super(request);
            this.authorizationValue = authorizationValue;
        }

        @Override
        public String getHeader(String name) {
            if ("Authorization".equalsIgnoreCase(name)) {
                return authorizationValue;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if ("Authorization".equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of(authorizationValue));
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = Collections.list(super.getHeaderNames());
            if (!names.stream().anyMatch(n -> "Authorization".equalsIgnoreCase(n))) {
                names.add("Authorization");
            }
            return Collections.enumeration(names);
        }
    }
}
