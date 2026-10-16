package com.baitly.iot;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;

final class MqttTls {
    private MqttTls() {}

    static SSLSocketFactory socketFactory(Path ca, Path clientPkcs12, char[] password) throws Exception {
        var trust = KeyStore.getInstance(KeyStore.getDefaultType());
        trust.load(null, null);
        try (var input = Files.newInputStream(ca)) {
            int index = 0;
            for (var certificate : CertificateFactory.getInstance("X.509").generateCertificates(input)) {
                trust.setCertificateEntry("iot-ca-" + index++, certificate);
            }
            if (index == 0) throw new IllegalArgumentException("Empty MQTT trust store");
        }
        var tm = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tm.init(trust);
        var key = KeyStore.getInstance("PKCS12");
        try (var input = Files.newInputStream(clientPkcs12)) { key.load(input, password); }
        var km = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        km.init(key, password);
        var ssl = SSLContext.getInstance("TLS");
        ssl.init(km.getKeyManagers(), tm.getTrustManagers(), null);
        return ssl.getSocketFactory();
    }
}
