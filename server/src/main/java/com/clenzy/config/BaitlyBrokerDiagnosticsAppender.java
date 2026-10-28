package com.clenzy.config;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.LoggingEvent;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.core.AppenderBase;
import java.util.Map;

/**
 * Baitly broker diagnostic boundary. Never formats a record, exception or context.
 * Dedicated non-additive loggers keep raw events away from console and Sentry appenders.
 * Logger enablement, delivery, retry and recovery policies stay intact.
 */
public final class BaitlyBrokerDiagnosticsAppender extends AppenderBase<ILoggingEvent> {
    static final String SAFE_LOGGER = "com.clenzy.diagnostics.BaitlyBroker";

    @Override
    protected void append(ILoggingEvent original) {
        String code;
        if (original.getLoggerName().equals(TenantIsolatingRecordInterceptor.class.getName())) {
            code = "BAITLY_BROKER_TENANT_CONTEXT_CLEARED";
        } else if (original.getLoggerName().equals("com.clenzy.tenant.KafkaTenantScope")) {
            code = "BAITLY_BROKER_SCOPE_REJECTED";
        } else {
            code = "BAITLY_BROKER_" + original.getLevel().levelStr;
        }
        Logger destination = ((LoggerContext) getContext()).getLogger(SAFE_LOGGER);
        LoggingEvent safe = new LoggingEvent(getClass().getName(), destination, original.getLevel(),
                code, null, null);
        safe.setThreadName("baitly-broker");
        safe.setMDCPropertyMap(Map.of());
        try {
            // Never forward the original event, not even for a null message.
            destination.callAppenders(safe);
        } catch (RuntimeException ignored) {
            // Fail closed: logging failures must not expose the original event or retry it.
        }
    }
}
