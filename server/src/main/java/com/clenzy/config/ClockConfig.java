package com.clenzy.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Source de temps injectable. Permet aux services d'injecter {@link Clock} par constructeur
 * (testable via {@code Clock.fixed(...)}) au lieu d'appeler {@code Instant.now()} en dur.
 *
 * <p>UTC : les services utilisent {@code clock.instant()} (indépendant du fuseau) ; les calculs
 * dépendant d'un fuseau passent explicitement la timezone (ex. timezone de la propriété, #9).</p>
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
