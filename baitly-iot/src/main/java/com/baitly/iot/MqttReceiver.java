package com.baitly.iot;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.Arrays;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/** Outbound connection to the private broker listener; no PMS credentials or MQTT admin rights. */
@Component
@ConditionalOnProperty(name = "baitly.iot.mqtt.enabled", havingValue = "true")
public class MqttReceiver implements SmartLifecycle {
    private static final Logger LOG = LoggerFactory.getLogger(MqttReceiver.class);
    private final MqttMeasurementIngress ingress;
    private final ObjectMapper json;
    private final MqttAsyncClient client;
    private final MqttConnectOptions options;
    private volatile boolean running;

    public MqttReceiver(MqttMeasurementIngress ingress, ObjectMapper json,
            @Value("${baitly.iot.mqtt.host}") String host,
            @Value("${baitly.iot.mqtt.port}") int port,
            @Value("${baitly.iot.mqtt.ca-file}") Path ca,
            @Value("${baitly.iot.mqtt.client-store}") Path store,
            @Value("${baitly.iot.mqtt.client-store-password}") String password) throws Exception {
        if (!host.matches("[a-zA-Z0-9.-]+") || port < 1 || port > 65535 || password.isBlank()) {
            throw new IllegalArgumentException("Invalid Baitly MQTT TLS configuration");
        }
        this.ingress = ingress;
        this.json = json;
        client = new MqttAsyncClient("ssl://" + host + ":" + port, "baitly-ingestor", new MemoryPersistence());
        LOG.info("Baitly MQTT receiver configured for {}:{}", host, port);
        options = new MqttConnectOptions();
        options.setMqttVersion(MqttConnectOptions.MQTT_VERSION_3_1_1);
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setConnectionTimeout(5);
        options.setKeepAliveInterval(30);
        options.setMaxInflight(8);
        options.setHttpsHostnameVerificationEnabled(true);
        char[] secret = password.toCharArray();
        try { options.setSocketFactory(MqttTls.socketFactory(ca, store, secret)); }
        finally { Arrays.fill(secret, '\0'); }
        client.setCallback(new MqttCallbackExtended() {
            @Override public void connectComplete(boolean reconnect, String uri) {
                if (!reconnect) return; // Initial subscription is checked synchronously by start().
                try {
                    client.subscribe("baitly/devices/+/measurements", 1, null, new IMqttActionListener() {
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
            @Override public void messageArrived(String topic, MqttMessage message) throws Exception {
                try {
                    var receipt = ingress.receive(topic, message.getPayload(), message.getQos(), message.isRetained());
                    // Application receipt, after the SQL transaction. PUBACK alone never proves persistence.
                    if (topic.matches("baitly/devices/[a-f0-9]{64}/measurements")) {
                        String ack = topic.substring(0, topic.lastIndexOf('/')) + "/acks";
                        client.publish(ack, json.writeValueAsBytes(receipt), 1, false);
                    }
                } catch (Exception failure) {
                    // Do not log payloads, certificate identities, SQL errors or secrets.
                    LOG.error("Baitly MQTT measurement failed; no application receipt emitted");
                }
            }
        });
    }

    @Override public void start() {
        try {
            client.connect(options).waitForCompletion(7000);
            var subscription = client.subscribe("baitly/devices/+/measurements", 1);
            subscription.waitForCompletion(5000);
            if (!subscriptionGranted(subscription)) throw new MqttException(MqttException.REASON_CODE_SUBSCRIBE_FAILED);
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
            client.close(true);
        } catch (MqttException failure) { LOG.warn("Baitly MQTT shutdown incomplete"); }
    }
    @Override public boolean isRunning() { return running; }

    private static boolean subscriptionGranted(IMqttToken token) {
        int[] qos = token.getGrantedQos();
        return qos != null && qos.length == 1 && qos[0] == 1;
    }
}
