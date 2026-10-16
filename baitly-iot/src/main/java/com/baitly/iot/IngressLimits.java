package com.baitly.iot;

import java.net.InetAddress;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Single-instance backpressure; the edge must also limit traffic before it reaches Java. */
@Component
public class IngressLimits {
    private final Window global;
    private final Window peers;
    private final Window devices;
    private final boolean edgeOnLoopback;

    /** Defaults used by tests and local runs. */
    public IngressLimits(Clock clock) {
        this(clock, 6000, 240, 12, 65536, false);
    }

    @Autowired
    public IngressLimits(Clock clock,
            @Value("${baitly.iot.limits.global-per-minute:6000}") int globalPerMinute,
            @Value("${baitly.iot.limits.peer-per-minute:240}") int peerPerMinute,
            @Value("${baitly.iot.limits.device-per-minute:12}") int devicePerMinute,
            @Value("${baitly.iot.limits.tracked-devices:65536}") int trackedDevices,
            @Value("${baitly.iot.limits.edge-proxy-on-loopback:false}") boolean edgeOnLoopback) {
        if (globalPerMinute < 1 || peerPerMinute < 1 || devicePerMinute < 1 || trackedDevices < 1) {
            throw new IllegalStateException("Baitly IoT ingress limits must be positive");
        }
        global = new Window(clock, globalPerMinute, 1);
        peers = new Window(clock, peerPerMinute, 4096);
        devices = new Window(clock, devicePerMinute, trackedDevices);
        this.edgeOnLoopback = edgeOnLoopback;
    }

    /**
     * The peer is checked first so that a throttled address cannot keep consuming the global budget.
     * Behind the dedicated edge proxy every request comes from loopback: the proxy enforces the
     * per-IP limit, and counting them all as one peer would cap the whole fleet at one address quota.
     */
    boolean acceptPeer(String address) {
        if (edgeOnLoopback && isLoopback(address)) return global.accept("all");
        return peers.accept(address) && global.accept("all");
    }

    /** MQTT: the broker bounds connections per certificate; only the shared database budget applies here. */
    boolean acceptBroker() { return global.accept("all"); }

    boolean acceptDevice(DeviceIdentity identity) { return devices.accept(identity.id().toString()); }

    private static boolean isLoopback(String address) {
        if (address == null || !address.matches("[0-9a-fA-F:.]+")) return false;
        try { return InetAddress.getByName(address).isLoopbackAddress(); }
        catch (java.net.UnknownHostException invalid) { return false; }
    }

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
