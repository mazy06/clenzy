package com.clenzy.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MetricsConfig {

    @Bean
    public Counter propertyAccessCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.property.access")
                .description("Number of property accesses")
                .register(meterRegistry);
    }

    @Bean
    public Counter userLoginCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.user.login")
                .description("Number of user logins")
                .register(meterRegistry);
    }

    @Bean
    public Timer propertyQueryTimer(MeterRegistry meterRegistry) {
        return Timer.builder("clenzy.property.query.duration")
                .description("Property query execution time")
                .register(meterRegistry);
    }

    @Bean
    public Timer cacheHitTimer(MeterRegistry meterRegistry) {
        return Timer.builder("clenzy.cache.hit.duration")
                .description("Cache hit response time")
                .register(meterRegistry);
    }

    @Bean
    public Counter cacheHitCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.cache.hits")
                .description("Number of cache hits")
                .register(meterRegistry);
    }

    @Bean
    public Counter cacheMissCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.cache.misses")
                .description("Number of cache misses")
                .register(meterRegistry);
    }
}
