package com.baitly.iot;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Single-instance backpressure; the edge must also limit traffic before it reaches Java. */
@Component
public class IngressLimits {
    private final Window global;
    private final Window peers;
    private final Window devices;

    public IngressLimits(Clock clock) {
        global = new Window(clock, 1200, 1);
        peers = new Window(clock, 240, 4096);
        devices = new Window(clock, 12, 4096);
    }

    boolean acceptPeer(String address) { return global.accept("all") && peers.accept(address); }
    boolean acceptDevice(DeviceIdentity identity) { return devices.accept(identity.id().toString()); }

    static final class Window {
        private final Clock clock;
        private final int maximum;
        private final int capacity;
        private final Map<String, Integer> counts = new HashMap<>();
        private long minute = Long.MIN_VALUE;

        Window(Clock clock, int maximum, int capacity) {
            this.clock = clock; this.maximum = maximum; this.capacity = capacity;
        }

        synchronized boolean accept(String key) {
            long now = Math.floorDiv(clock.millis(), 60_000);
            if (now != minute) { counts.clear(); minute = now; }
            Integer count = counts.get(key);
            if (count == null && counts.size() >= capacity || count != null && count >= maximum) return false;
            counts.put(key, count == null ? 1 : count + 1);
            return true;
        }
    }
}
