package com.baitly.iot;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/** Outcome counters only: no device identifier, payload, address or secret ever becomes a tag. */
@Component
public class IngressMetrics {
    private final MeterRegistry registry;

    public IngressMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    void record(String transport, int status, boolean duplicate) {
        Counter.builder("baitly.iot.ingress")
                .description("Measurement submissions by transport and outcome")
                .tag("transport", transport)
                .tag("status", Integer.toString(status))
                .tag("duplicate", Boolean.toString(duplicate))
                .register(registry).increment();
    }
}
