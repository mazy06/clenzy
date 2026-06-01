package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Decodeur JWT durci pour la prod : valide <b>issuer + audience</b>.
 *
 * <p>Actif sur tout boot en {@code @Profile("prod")}. Remplace l'auto-config Spring
 * Boot (qui ne fournit qu'un decodeur issuer-only) par un decodeur qui ajoute la
 * verification de la claim {@code aud}, garantissant que les tokens ont bien ete
 * emis pour l'API Clenzy (par defaut audience {@code clenzy-api}).</p>
 *
 * <p><b>Prerequis Keycloak</b> : un mapper Audience doit injecter {@code clenzy-api}
 * dans la claim {@code aud} des access tokens du client {@code clenzy-api}. Sans ce
 * mapper, les tokens portent {@code aud: "account"} par defaut et seront tous
 * rejetes — voir {@code docs/runbooks/jwt-audience-rollout.md} pour la procedure
 * d'installation du mapper (~2 min via console admin Keycloak).</p>
 *
 * <p>Lorsque ce bean est present, l'auto-config Spring Boot recule
 * ({@code @ConditionalOnMissingBean(JwtDecoder.class)}) et c'est ce decodeur qui est
 * utilise par la chaine de securite prod.</p>
 */
@Configuration
@Profile("prod")
public class ProdJwtDecoderConfig {

    private static final Logger log = LoggerFactory.getLogger(ProdJwtDecoderConfig.class);

    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri,
            @Value("${clenzy.security.jwt.expected-audience:clenzy-api}") String expectedAudience) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuerUri),
                new JwtAudienceValidator(expectedAudience));
        decoder.setJwtValidator(validator);
        log.info("Validation JWT durcie ACTIVE : issuer + audience attendue '{}'", expectedAudience);
        return decoder;
    }
}
