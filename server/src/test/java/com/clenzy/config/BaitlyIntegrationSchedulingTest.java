package com.clenzy.config;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

import static org.assertj.core.api.Assertions.assertThat;

class BaitlyIntegrationSchedulingTest {
    @Configuration
    @EnableScheduling
    static class Fixture {
        @Bean Probe probe() { return new Probe(); }
    }
    static class Probe {
        int calls;
        @Scheduled(fixedDelay = 1) public void tick() { calls++; }
    }
    @Test void integrationFixtureHasNoBackgroundCallbacksButKeepsTheRealWorkerCallable() {
        try (var context = new AnnotationConfigApplicationContext(TestSecurityConfig.class, Fixture.class)) {
            assertThat(context.getBeansOfType(ScheduledAnnotationBeanPostProcessor.class)).isEmpty();
            var worker = context.getBean(Probe.class);
            assertThat(worker.calls).isZero();
            worker.tick();
            assertThat(worker.calls).isEqualTo(1);
        }
    }
    @Test void ordinarySchedulingConfigurationRemainsEnabledOutsideTheIntegrationFixture() {
        try (var context = new AnnotationConfigApplicationContext(Fixture.class)) {
            assertThat(context.getBeansOfType(ScheduledAnnotationBeanPostProcessor.class)).hasSize(1);
        }
    }
}
