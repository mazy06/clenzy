package com.baitly.iot;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class DeviceSecretsTest {
    @Test
    void whenGeneratingCredentials_thenTheyAreDistinctAndHashIsStable() {
        DeviceSecrets secrets = new DeviceSecrets();
        String first = secrets.generate();
        assertThat(first).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(secrets.generate());
        assertThat(secrets.hash(first)).hasSize(64).isEqualTo(secrets.hash(first));
    }
}
