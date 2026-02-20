package com.clenzy.config;

import com.clenzy.config.RateLimitInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration du rate limiting au niveau applicatif.
 * Complement au rate limiting Nginx (qui protege au niveau reseau).
 *
 * Limites par defaut :
 * - API publique (auth) : 30 req/min par IP
 * - API authentifiee : 300 req/min par utilisateur
 * - Webhooks : 1000 req/min
 *
 * Exigence Airbnb Partner : protection contre les abus d'API.
 */
@Configuration
public class RateLimitConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;

    public RateLimitConfig(RateLimitInterceptor rateLimitInterceptor) {
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/health");
    }
}
