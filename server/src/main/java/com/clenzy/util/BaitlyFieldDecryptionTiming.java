package com.clenzy.util;

import java.util.function.Supplier;

/** Mesure locale à la lecture : aucune donnée personnelle, aucun cache, aucun état partagé entre requêtes. */
public final class BaitlyFieldDecryptionTiming implements AutoCloseable {
    private static final ThreadLocal<BaitlyFieldDecryptionTiming> ACTIVE = new ThreadLocal<>();
    private final BaitlyFieldDecryptionTiming previous;
    private long nanos;
    private int count;

    private BaitlyFieldDecryptionTiming() {
        previous = ACTIVE.get();
        ACTIVE.set(this);
    }

    public static BaitlyFieldDecryptionTiming open() { return new BaitlyFieldDecryptionTiming(); }
    public long nanos() { return nanos; }
    public int count() { return count; }

    public static String record(Supplier<String> decrypt) {
        var timing = ACTIVE.get();
        if (timing == null) return decrypt.get();
        long started = System.nanoTime();
        try { return decrypt.get(); }
        finally { timing.nanos += System.nanoTime() - started; timing.count++; }
    }

    @Override public void close() {
        if (previous == null) ACTIVE.remove();
        else ACTIVE.set(previous);
    }
}
