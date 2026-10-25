package com.clenzy.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.util.LogbackMDCAdapter;
import ch.qos.logback.contrib.json.classic.JsonLayout;
import ch.qos.logback.core.read.ListAppender;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class BaitlyBrokerDiagnosticsPrivacyTest {
    private LoggerContext context;
    private ListAppender<ILoggingEvent> output;

    @BeforeEach
    void setup() {
        context = new LoggerContext();
        context.setMDCAdapter(new LogbackMDCAdapter());
        context.getLogger(Logger.ROOT_LOGGER_NAME).setLevel(Level.DEBUG);
        output = new ListAppender<>();
        output.setContext(context);
        output.start();
        context.getLogger(Logger.ROOT_LOGGER_NAME).addAppender(output);
        var boundary = new BaitlyBrokerDiagnosticsAppender();
        boundary.setContext(context);
        boundary.start();
        for (String name : new String[]{"org.apache.kafka", "org.springframework.kafka",
                TenantIsolatingRecordInterceptor.class.getName(), "com.clenzy.tenant.KafkaTenantScope"}) {
            context.getLogger(name).setAdditive(false);
            context.getLogger(name).addAppender(boundary);
        }
    }

    @AfterEach
    void cleanup() {
        context.stop();
    }

    static Stream<String> nativeLoggers() {
        return Stream.of("org.apache.kafka.clients.producer.internals.Sender",
                "org.apache.kafka.common.serialization.Synthetic",
                "org.springframework.kafka.support.LoggingProducerListener",
                "org.springframework.kafka.listener.DefaultErrorHandler",
                "org.springframework.kafka.listener.KafkaMessageListenerContainer",
                "org.springframework.kafka.listener.DeadLetterPublishingRecoverer",
                TenantIsolatingRecordInterceptor.class.getName(), "com.clenzy.tenant.KafkaTenantScope");
    }

    @ParameterizedTest
    @MethodSource("nativeLoggers")
    void nativeMessagesCausesArgumentsContextAndThreadNeverReachAppenders(String name) {
        String secret = "SYNTHETIC_PRIVATE_email@example.test_PIN_92841_token_record";
        context.getMDCAdapter().put("orgId", secret);
        context.getMDCAdapter().put("requestId", secret);
        var failure = new IllegalStateException(secret, new RuntimeException(secret));
        failure.addSuppressed(new RuntimeException(secret));
        String originalThread = Thread.currentThread().getName();
        try {
            Thread.currentThread().setName(secret);
            context.getLogger(name).warn("record {}", secret, failure);
            context.getLogger(name).atError().addKeyValue("payload", secret).setCause(failure).log(secret);
        } finally {
            Thread.currentThread().setName(originalThread);
        }
        assertThat(output.list).hasSize(2);
        assertThat(output.list).extracting(ILoggingEvent::getLevel).containsExactly(Level.WARN, Level.ERROR);
        for (var event : output.list) {
            assertThat(event.getLoggerName()).isEqualTo(BaitlyBrokerDiagnosticsAppender.SAFE_LOGGER);
            assertThat(event.getFormattedMessage()).startsWith("BAITLY_BROKER_").doesNotContain(secret);
            assertThat(event.getArgumentArray()).isNull();
            assertThat(event.getThrowableProxy()).isNull();
            assertThat(event.getMDCPropertyMap()).isEmpty();
            assertThat(event.getKeyValuePairs()).isNullOrEmpty();
            assertThat(event.getMarkerList()).isNullOrEmpty();
            assertThat(event.getThreadName()).isEqualTo("baitly-broker");
            var layout = new JsonLayout();
            layout.setContext(context);
            layout.start();
            assertThat(layout.doLayout(event)).doesNotContain(secret, "example.test", "92841");
        }
        // No changes to the business context, exception or thread.
        assertThat(context.getMDCAdapter().get("orgId")).isEqualTo(secret);
        assertThat(failure.getSuppressed()).hasSize(1);
        assertThat(Thread.currentThread().getName()).isEqualTo(originalThread);
    }

    @Test
    void droppedArgumentsAreNeverFormatted() {
        Object record = new Object() {
            @Override public String toString() { throw new AssertionError("Record must not be evaluated"); }
        };
        assertThatCode(() -> context.getLogger("org.apache.kafka.clients.Synthetic")
                .error("record {}", record)).doesNotThrowAnyException();
        assertThat(output.list).singleElement().extracting(ILoggingEvent::getFormattedMessage)
                .isEqualTo("BAITLY_BROKER_ERROR");
    }

    @Test
    void respectsSourceThresholdIncludingDebugAndOff() {
        var source = context.getLogger("org.springframework.kafka.listener.Synthetic");
        source.setLevel(Level.INFO);
        source.debug("private");
        source.trace("private");
        source.info("private");
        source.setLevel(Level.OFF);
        source.error("private");
        assertThat(output.list).singleElement().extracting(ILoggingEvent::getFormattedMessage)
                .isEqualTo("BAITLY_BROKER_INFO");
    }

    @Test
    void leavesOtherLoggersAloneAndDoesNotRecurse() {
        context.getLogger("com.clenzy.service.Synthetic").info("BAITLY_TEST_OTHER");
        context.getLogger(BaitlyBrokerDiagnosticsAppender.SAFE_LOGGER).info("BAITLY_TEST_SAFE");
        context.getLogger("org.apache.kafka.clients.Synthetic").debug("private");
        assertThat(output.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("BAITLY_TEST_OTHER", "BAITLY_TEST_SAFE", "BAITLY_BROKER_DEBUG");
    }

    @Test
    void enabledProbesAndNullMessagesDoNotLeakOrChangeLoggerEnablement() {
        var logger = context.getLogger("org.springframework.kafka.listener.Synthetic");
        assertThat(logger.isWarnEnabled()).isTrue();
        assertThat(logger.isDebugEnabled()).isTrue();
        assertThat(output.list).isEmpty();
        context.getMDCAdapter().put("orgId", "SYNTHETIC_PRIVATE");
        logger.warn((String) null);
        assertThat(output.list).singleElement().satisfies(event -> {
            assertThat(event.getFormattedMessage()).isEqualTo("BAITLY_BROKER_WARN");
            assertThat(event.getMDCPropertyMap()).isEmpty();
        });
    }

    @Test
    void boundaryIsInstalledBeforeEveryProfileAppender() throws Exception {
        try (var resource = getClass().getResourceAsStream("/logback-spring.xml")) {
            assertThat(resource).isNotNull();
            String xml = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
            assertThat(xml).contains("class=\"com.clenzy.config.BaitlyBrokerDiagnosticsAppender\"");
            for (String name : new String[]{"org.apache.kafka", "org.springframework.kafka",
                    TenantIsolatingRecordInterceptor.class.getName(), "com.clenzy.tenant.KafkaTenantScope"}) {
                assertThat(xml).contains("<logger name=\"" + name + "\" additivity=\"false\">");
            }
            assertThat(xml.indexOf("name=\"BROKER_DIAGNOSTICS\"")).isLessThan(xml.indexOf("<springProfile"));
        }
    }
}
