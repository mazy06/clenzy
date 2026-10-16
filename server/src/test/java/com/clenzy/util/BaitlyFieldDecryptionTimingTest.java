package com.clenzy.util;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class BaitlyFieldDecryptionTimingTest {
    @Test void isolatesConcurrentReadsAndCleansUpAfterFailure() throws Exception {
        try (var outer = BaitlyFieldDecryptionTiming.open()) {
            assertThat(BaitlyFieldDecryptionTiming.record(() -> "value")).isEqualTo("value");
            var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
            try {
                assertThat(executor.submit(() -> {
                    try (var separate = BaitlyFieldDecryptionTiming.open()) {
                        BaitlyFieldDecryptionTiming.record(() -> "other");
                        return separate.count();
                    }
                }).get()).isEqualTo(1);
            } finally { executor.shutdownNow(); }
            try (var nested = BaitlyFieldDecryptionTiming.open()) {
                assertThatThrownBy(() -> BaitlyFieldDecryptionTiming.record(() -> {
                    throw new IllegalArgumentException("invalid ciphertext");
                })).isInstanceOf(IllegalArgumentException.class);
                assertThat(nested.count()).isEqualTo(1);
            }
            BaitlyFieldDecryptionTiming.record(() -> "last");
            assertThat(outer.count()).isEqualTo(2);
        }
        try (var fresh = BaitlyFieldDecryptionTiming.open()) { assertThat(fresh.count()).isZero(); }
    }
}
