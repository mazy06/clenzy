package com.baitly.iot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import static org.assertj.core.api.Assertions.*;

/** Real TLS broker + actual simulator + Liquibase/PostgreSQL + the private API used by the PMS. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=${BAITLY_IOT_TEST_DATABASE_URL}",
        "spring.datasource.username=${BAITLY_IOT_TEST_DATABASE_USER}",
        "spring.datasource.password=${BAITLY_IOT_TEST_DATABASE_PASSWORD:}",
        "baitly.iot.service-token=mqtt-test-private-api-key-never-use-outside-tests"
})
@EnabledIfEnvironmentVariable(named = "BAITLY_IOT_MQTT_TEST", matches = "true")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MqttJourneyTest {
    private static final String PASSWORD = "disposable-mqtt-test-only";
    private static Path root;
    private static Process broker;
    private static int devicePort, privatePort, internalPort;
    @Autowired DeviceService service;
    @Autowired DeviceSecrets secrets;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource static void setup(DynamicPropertyRegistry properties) throws Exception {
        devicePort = freePort(); privatePort = freePort(); internalPort = freePort();
        root = Files.createTempDirectory("baitly-mqtt-test-").resolve("pki");
        runPython("scripts/mqtt_pki.py", "init-test", "--directory", root.toString());
        Path deploy = Path.of("deploy").toAbsolutePath();
        for (String acl : new String[]{"devices.acl", "ingestion.acl"}) {
            Files.copy(deploy.resolve(acl), root.resolve(acl));
            Files.setPosixFilePermissions(root.resolve(acl), java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
        }
        String config = Files.readString(deploy.resolve("mosquitto.conf"))
                .replace("listener 8883", "listener " + devicePort + " 127.0.0.1")
                .replace("listener 8884", "listener " + privatePort)
                .replace("/etc/baitly-mqtt/tls", root.toString())
                .replace("/etc/baitly-mqtt/devices.acl", root.resolve("devices.acl").toString())
                .replace("/etc/baitly-mqtt/ingestion.acl", root.resolve("ingestion.acl").toString());
        Files.writeString(root.resolve("mosquitto.conf"), config.replace("log_type error", "log_type all")
                .replace("connection_messages false", "connection_messages true"));
        broker = new ProcessBuilder(python(), "scripts/run_mqtt_test_broker.py",
                System.getenv().getOrDefault("BAITLY_MOSQUITTO_BINARY", "mosquitto"),
                "-c", root.resolve("mosquitto.conf").toString())
                .redirectErrorStream(true).redirectOutput(root.resolve("broker.log").toFile()).start();
        boolean ready = false;
        for (int i = 0; i < 200; i++) {
            if (!broker.isAlive()) throw new IllegalStateException("Test broker failed: " + Files.readString(root.resolve("broker.log")));
            if (Files.readString(root.resolve("broker.log")).contains(" running")) { ready = true; break; }
            Thread.sleep(50);
        }
        if (!ready) throw new IllegalStateException("Test broker did not start");
        properties.add("baitly.iot.internal-port", () -> internalPort);
        properties.add("baitly.iot.mqtt.enabled", () -> true);
        properties.add("baitly.iot.mqtt.host", () -> "127.0.0.1");
        properties.add("baitly.iot.mqtt.port", () -> privatePort);
        properties.add("baitly.iot.mqtt.ca-file", () -> root.resolve("server-ca.crt").toString());
        properties.add("baitly.iot.mqtt.client-store", () -> root.resolve("ingestor.p12").toString());
        properties.add("baitly.iot.mqtt.client-store-password", () -> PASSWORD);
    }

    @AfterAll static void stopOwnedBroker() throws Exception {
        if (broker != null) {
            broker.destroy();
            if (!broker.waitFor(5, TimeUnit.SECONDS)) broker.destroyForcibly();
        }
        if (root != null && Files.exists(root)) {
            Files.copy(root.resolve("broker.log"), Path.of("target/mqtt-broker-test.log"), StandardCopyOption.REPLACE_EXISTING);
            try (var files = Files.walk(root.getParent())) {
                for (Path path : files.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }

    @Test void simulatorTraversesTlsBrokerDatabaseAndPrivatePmsReadApi() throws Exception {
        var first = simulatedDevice();
        var second = simulatedDevice();
        var event = UUID.randomUUID();
        String measured = Instant.now().toString();
        String identity = secrets.hash(first.token());
        issue(identity);
        issue(secrets.hash(second.token()));

        // Actual command-line simulator, including application acknowledgement rather than PUBACK.
        var command = new ProcessBuilder(python(), "scripts/simulate_noise.py", "--transport", "mqtt",
                "--mqtt-host", "127.0.0.1", "--mqtt-port", Integer.toString(devicePort),
                "--ca-file", root.resolve("server-ca.crt").toString(),
                "--cert-file", root.resolve("device-" + identity + ".crt").toString(),
                "--key-file", root.resolve("device-" + identity + ".key").toString(),
                "--level", "62.4", "--event-id", event.toString(), "--measured-at", measured);
        command.environment().put("BAITLY_IOT_DEVICE_TOKEN", first.token());
        var simulation = command.redirectErrorStream(true).start();
        assertThat(simulation.waitFor(25, TimeUnit.SECONDS)).isTrue();
        assertThat(simulation.exitValue()).withFailMessage("Simulator: %s", new String(simulation.getInputStream().readAllBytes())).isZero();
        var history = readHistory(first.device().id(), 987);
        assertThat(history.statusCode()).isEqualTo(200);
        assertThat(json.readTree(history.body()).get(0).path("eventId").asText()).isEqualTo(event.toString());
        assertThat(readHistory(first.device().id(), 988).statusCode()).isEqualTo(404);
        assertThat(service.get(first.device().id(), 987).online()).isTrue();
        assertThat(service.get(first.device().id(), 987).simulation()).isTrue();

        try (var a = connection(identity); var b = connection(secrets.hash(second.token()))) {
            var payload = measurement(event, measured);
            assertThat(a.send(payload).path("duplicate").asBoolean()).isTrue();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements WHERE device_id = ?", Integer.class,
                    first.device().id())).isEqualTo(1);
            // A cannot publish to B or observe B's receipts. Caller supplied usernames/client IDs are irrelevant.
            a.client.publish("baitly/devices/" + secrets.hash(second.token()) + "/measurements", payload, 1, false);
            assertThat(b.receipts.poll(500, TimeUnit.MILLISECONDS)).isNull();
            assertThat(service.measurements(second.device().id(), 987, Instant.now().minusSeconds(60), Instant.now().plusSeconds(1), 100)).isEmpty();
            a.client.subscribe("baitly/devices/" + secrets.hash(second.token()) + "/acks", 1);
            assertThat(b.send(measurement(UUID.randomUUID(), measured)).path("status").asInt()).isEqualTo(200);
            assertThat(a.receipts.poll(500, TimeUnit.MILLISECONDS)).isNull();
            // A device cannot forge Baitly's own persistence receipt, even on its own ack topic.
            a.client.publish(a.prefix + "/acks", "{\"status\":200}".getBytes(), 1, false);
            assertThat(a.receipts.poll(500, TimeUnit.MILLISECONDS)).isNull();
            assertThat(a.send("{\"organizationId\":988}".getBytes()).path("status").asInt()).isEqualTo(400);

            var rotated = service.rotate(first.device().id(), 987);
            assertThat(a.send(measurement(UUID.randomUUID(), measured)).path("status").asInt()).isEqualTo(401);
            String next = secrets.hash(rotated.token());
            issue(next);
            try (var updated = connection(next)) {
                assertThat(updated.send(measurement(UUID.randomUUID(), measured)).path("status").asInt()).isEqualTo(200);
                service.revoke(first.device().id(), 987);
                assertThat(updated.send(measurement(UUID.randomUUID(), measured)).path("status").asInt()).isEqualTo(401);
            }
        }
    }

    @Test void brokerRejectsMissingCertificateWrongAuthorityAndDeviceAccessToPrivateListener() throws Exception {
        var client = new MqttClient("ssl://127.0.0.1:" + devicePort, UUID.randomUUID().toString(), new MemoryPersistence());
        var options = new MqttConnectOptions();
        var trust = java.security.KeyStore.getInstance(java.security.KeyStore.getDefaultType());
        trust.load(null, null);
        try (var input = Files.newInputStream(root.resolve("server-ca.crt"))) {
            trust.setCertificateEntry("test", java.security.cert.CertificateFactory.getInstance("X.509").generateCertificate(input));
        }
        var tm = javax.net.ssl.TrustManagerFactory.getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm());
        tm.init(trust);
        var tls = javax.net.ssl.SSLContext.getInstance("TLS");
        tls.init(null, tm.getTrustManagers(), null);
        options.setSocketFactory(tls.getSocketFactory()); options.setConnectionTimeout(2);
        assertThatThrownBy(() -> client.connect(options)).isInstanceOf(MqttException.class);
        client.close();
        // The ingestor's CA cannot mint public device identities, even with a trusted server certificate.
        assertThatThrownBy(() -> rawConnection("ingestor", devicePort)).isInstanceOf(MqttException.class);
        var credentials = simulatedDevice();
        String hash = secrets.hash(credentials.token()); issue(hash);
        assertThatThrownBy(() -> rawConnection("device-" + hash, privatePort)).isInstanceOf(MqttException.class);
    }

    private DeviceContracts.DeviceCredentials simulatedDevice() {
        UUID id = UUID.randomUUID();
        service.ensureSimulator(id, 987, new DeviceContracts.RegisterDevice(11, "MQTT simulated market device", 60));
        return service.rotate(id, 987);
    }
    private byte[] measurement(UUID event, String measured) throws Exception {
        return json.writeValueAsBytes(new DeviceContracts.NoiseMeasurement(event, Instant.parse(measured), 10, 62.4));
    }
    private HttpResponse<String> readHistory(UUID id, long org) throws Exception {
        return HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + internalPort
                + "/internal/v1/organizations/" + org + "/devices/" + id + "/measurements?from="
                + Instant.now().minusSeconds(60) + "&to=" + Instant.now().plusSeconds(1)))
                .header("Authorization", "Bearer mqtt-test-private-api-key-never-use-outside-tests").GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    private void issue(String hash) throws Exception {
        runPython("scripts/mqtt_pki.py", "issue-device", "--directory", root.toString(), "--fingerprint", hash, "--days", "1");
    }
    private Connection connection(String hash) throws Exception { return new Connection(hash, rawConnection("device-" + hash, devicePort)); }
    private MqttClient rawConnection(String store, int port) throws Exception {
        var client = new MqttClient("ssl://127.0.0.1:" + port, UUID.randomUUID().toString(), new MemoryPersistence());
        client.setTimeToWait(5000);
        var options = new MqttConnectOptions();
        options.setHttpsHostnameVerificationEnabled(true);
        options.setSocketFactory(MqttTls.socketFactory(root.resolve("server-ca.crt"), root.resolve(store + ".p12"), PASSWORD.toCharArray()));
        options.setConnectionTimeout(2);
        try { client.connect(options); return client; }
        catch (MqttException failure) { client.close(true); throw failure; }
    }
    private class Connection implements AutoCloseable {
        final MqttClient client;
        final String prefix;
        final LinkedBlockingQueue<JsonNode> receipts = new LinkedBlockingQueue<>(8);
        Connection(String hash, MqttClient client) throws Exception {
            this.client = client; this.prefix = "baitly/devices/" + hash;
            client.setCallback(new MqttCallback() {
                public void connectionLost(Throwable reason) {}
                public void deliveryComplete(IMqttDeliveryToken token) {}
                public void messageArrived(String topic, MqttMessage message) throws Exception { receipts.offer(json.readTree(message.getPayload())); }
            });
            client.subscribe(prefix + "/acks", 1);
        }
        JsonNode send(byte[] payload) throws Exception {
            client.publish(prefix + "/measurements", payload, 1, false);
            var receipt = receipts.poll(8, TimeUnit.SECONDS);
            assertThat(receipt).as("Application persistence receipt").isNotNull();
            return receipt;
        }
        @Override public void close() throws Exception { if (client.isConnected()) client.disconnect(); client.close(); }
    }
    private static int freePort() throws Exception { try (var socket = new ServerSocket(0)) { return socket.getLocalPort(); } }
    private static String python() { return System.getenv().getOrDefault("BAITLY_IOT_TEST_PYTHON", "python3"); }
    private static void runPython(String... args) throws Exception {
        var command = new java.util.ArrayList<String>(); command.add(python()); command.addAll(java.util.List.of(args));
        var builder = new ProcessBuilder(command).redirectErrorStream(true);
        builder.environment().put("BAITLY_MQTT_P12_PASSWORD", PASSWORD);
        var process = builder.start();
        if (!process.waitFor(20, TimeUnit.SECONDS)) { process.destroyForcibly(); throw new IllegalStateException("Test PKI timeout"); }
        if (process.exitValue() != 0) throw new IllegalStateException("Test PKI failed: " + new String(process.getInputStream().readAllBytes()));
    }
}
