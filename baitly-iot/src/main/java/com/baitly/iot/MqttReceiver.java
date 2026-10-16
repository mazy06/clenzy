package com.baitly.iot;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/**
 * Outbound connection to the private broker listener; no PMS credentials or MQTT admin rights.
 * The Paho callback only enqueues: SQL runs on a bounded worker pool, so a slow database never
 * blocks the network thread, and a full queue answers 429 instead of silently dropping.
 */
@Component("mqtt")
@ConditionalOnProperty(name = "baitly.iot.mqtt.enabled", havingValue = "true")
public class MqttReceiver implements SmartLifecycle, HealthIndicator {
    private static final Logger LOG = LoggerFactory.getLogger(MqttReceiver.class);
    private static final String MEASUREMENTS = "baitly/devices/+/measurements";
    private final MqttMeasurementIngress ingress;
    private final ObjectMapper json;
    private final MqttAsyncClient client;
    private final MqttConnectOptions options;
    private final String subscription;
    private final ThreadPoolExecutor workers;
    private final AtomicInteger unacknowledged = new AtomicInteger();
    private volatile boolean running;

    public MqttReceiver(MqttMeasurementIngress ingress, ObjectMapper json, MeterRegistry registry,
            @Value("${baitly.iot.mqtt.host}") String host,
            @Value("${baitly.iot.mqtt.port}") int port,
            @Value("${baitly.iot.mqtt.ca-file}") Path ca,
            @Value("${baitly.iot.mqtt.client-store}") Path store,
            @Value("${baitly.iot.mqtt.client-store-password}") String password,
            @Value("${baitly.iot.mqtt.client-id:baitly-ingestor}") String clientId,
            @Value("${baitly.iot.mqtt.shared-group:}") String sharedGroup,
            @Value("${baitly.iot.mqtt.workers:4}") int workerCount,
            @Value("${baitly.iot.mqtt.queue-capacity:512}") int queueCapacity) throws Exception {
        if (!host.matches("[a-zA-Z0-9.-]+") || port < 1 || port > 65535 || password.isBlank()
                || !clientId.matches("[a-zA-Z0-9-]{1,64}") || !sharedGroup.matches("[a-zA-Z0-9-]{0,64}")
                || workerCount < 1 || workerCount > 64 || queueCapacity < 1 || queueCapacity > 100_000) {
            throw new IllegalArgumentException("Invalid Baitly MQTT TLS configuration");
        }
        this.ingress = ingress;
        this.json = json;
        // Several receivers share the stream through a broker shared subscription, each with its own certificate.
        this.subscription = sharedGroup.isEmpty() ? MEASUREMENTS : "$share/" + sharedGroup + "/" + MEASUREMENTS;
        workers = new ThreadPoolExecutor(workerCount, workerCount, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(queueCapacity), runnable -> {
                    Thread thread = new Thread(runnable, "baitly-mqtt-ingest");
                    thread.setDaemon(true);
                    return thread;
                }, new ThreadPoolExecutor.AbortPolicy());
        Gauge.builder("baitly.iot.mqtt.queue", workers, pool -> pool.getQueue().size())
                .description("MQTT measurements waiting for a database worker").register(registry);
        Gauge.builder("baitly.iot.mqtt.connected", this, receiver -> receiver.client.isConnected() ? 1 : 0)
                .register(registry);
        client = new MqttAsyncClient("ssl://" + host + ":" + port, clientId, new MemoryPersistence());
        LOG.info("Baitly MQTT receiver configured for {}:{}", host, port);
        options = new MqttConnectOptions();
        options.setMqttVersion(MqttConnectOptions.MQTT_VERSION_3_1_1);
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setConnectionTimeout(5);
        options.setKeepAliveInterval(30);
        // Receipts are QoS 1: leave room for one per queued measurement and per worker.
        options.setMaxInflight(Math.min(65535, queueCapacity + workerCount));
        options.setHttpsHostnameVerificationEnabled(true);
        char[] secret = password.toCharArray();
        try { options.setSocketFactory(MqttTls.socketFactory(ca, store, secret)); }
        finally { Arrays.fill(secret, '\0'); }
        client.setCallback(new MqttCallbackExtended() {
            @Override public void connectComplete(boolean reconnect, String uri) {
                if (!reconnect) return; // Initial subscription is checked synchronously by start().
                try {
                    client.subscribe(subscription, 1, null, new IMqttActionListener() {
                        @Override public void onSuccess(IMqttToken token) {
                            if (!subscriptionGranted(token)) LOG.error("Baitly MQTT subscription denied after reconnect");
                        }
                        @Override public void onFailure(IMqttToken token, Throwable cause) {
                            LOG.error("Baitly MQTT subscription failed after reconnect");
                        }
                    });
                }
                catch (MqttException failure) { LOG.error("Baitly MQTT subscription failed"); }
            }
            @Override public void connectionLost(Throwable cause) { LOG.warn("Baitly MQTT connection lost"); }
            @Override public void deliveryComplete(IMqttDeliveryToken token) {}
            @Override public void messageArrived(String topic, MqttMessage message) {
                if (!MqttMeasurementIngress.TOPIC.matcher(topic).matches()) return;
                byte[] payload = message.getPayload();
                int qos = message.getQos();
                boolean retained = message.isRetained();
                try {
                    workers.execute(() -> acknowledge(topic, () -> ingress.receive(topic, payload, qos, retained)));
                } catch (RejectedExecutionException full) {
                    acknowledge(topic, ingress::overloaded);
                }
            }
        });
    }

    private void acknowledge(String topic, java.util.function.Supplier<MqttMeasurementIngress.Receipt> outcome) {
        try {
            var receipt = outcome.get();
            // Application receipt, after the SQL transaction. PUBACK alone never proves persistence.
            String ack = topic.substring(0, topic.lastIndexOf('/')) + "/acks";
            client.publish(ack, json.writeValueAsBytes(receipt), 1, false);
        } catch (Exception failure) {
            // Do not log payloads, certificate identities, SQL errors or secrets. The device retries
            // with the same eventId; persistence is idempotent.
            unacknowledged.incrementAndGet();
            LOG.error("Baitly MQTT measurement failed or receipt not sent; device will retry");
        }
    }

    @Override public void start() {
        try {
            client.connect(options).waitForCompletion(7000);
            var token = client.subscribe(subscription, 1);
            token.waitForCompletion(5000);
            if (!subscriptionGranted(token)) throw new MqttException(MqttException.REASON_CODE_SUBSCRIBE_FAILED);
            running = true;
        } catch (MqttException failure) {
            try { client.close(true); } catch (MqttException ignored) { }
            throw new IllegalStateException("Baitly MQTT TLS connection failed", failure);
        }
    }

    @Override public void stop() {
        running = false;
        try {
            if (client.isConnected()) client.disconnect().waitForCompletion(3000);
        } catch (MqttException failure) { LOG.warn("Baitly MQTT disconnect incomplete"); }
        workers.shutdown();
        try {
            if (!workers.awaitTermination(5, TimeUnit.SECONDS)) workers.shutdownNow();
        } catch (InterruptedException interrupted) {
            workers.shutdownNow();
            Thread.currentThread().interrupt();
        }
        try { client.close(true); } catch (MqttException failure) { LOG.warn("Baitly MQTT shutdown incomplete"); }
    }

    @Override public boolean isRunning() { return running; }

    @Override public Health health() {
        var health = client.isConnected() ? Health.up() : Health.down();
        return health.withDetail("queued", workers.getQueue().size()).withDetail("unacknowledged", unacknowledged.get()).build();
    }

    private static boolean subscriptionGranted(IMqttToken token) {
        int[] qos = token.getGrantedQos();
        return qos != null && qos.length == 1 && qos[0] == 1;
    }
}
