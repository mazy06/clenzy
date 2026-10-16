#!/usr/bin/env python3
"""Send a synthetic measurement over HTTP or MQTT/mTLS; wait for Baitly's persistence receipt."""

import argparse
import datetime
import hashlib
import json
import math
import os
import sys
import ssl
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def send_mqtt(args, token, payload):
    # Deferred import keeps the HTTP simulator usable without additional dependencies.
    import paho.mqtt.client as mqtt
    fingerprint = hashlib.sha256(token.encode("utf-8")).hexdigest()
    topic = "baitly/devices/" + fingerprint
    context = ssl.create_default_context(cafile=args.ca_file)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(args.cert_file, args.key_file)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="simulator-" + str(uuid.uuid4()),
                         protocol=mqtt.MQTTv311, clean_session=True)
    client.tls_set_context(context)
    client.max_inflight_messages_set(1)
    client.max_queued_messages_set(2)
    done = threading.Event()
    outcome = {"status": None}

    def connected(client, userdata, flags, reason, properties):
        if reason.is_failure:
            done.set()
        else:
            client.subscribe(topic + "/acks", qos=1)

    def subscribed(client, userdata, mid, reasons, properties):
        if not reasons or any(reason.is_failure for reason in reasons):
            done.set()
        else:
            client.publish(topic + "/measurements", json.dumps(payload).encode("utf-8"), qos=1, retain=False)

    def received(client, userdata, message):
        if len(message.payload) > 4096:
            return
        try:
            receipt = json.loads(message.payload)
        except (ValueError, UnicodeError):
            return
        if receipt.get("eventId") == payload["eventId"]:
            outcome.update(receipt)
            done.set()
        elif receipt.get("eventId") is None and receipt.get("status") in (400, 401, 413, 429):
            outcome["status"] = receipt["status"]
            done.set()

    client.on_connect = connected
    client.on_subscribe = subscribed
    client.on_message = received
    try:
        client.connect(args.mqtt_host, args.mqtt_port, keepalive=30)
        client.loop_start()
        if not done.wait(15):
            print("SIMULATION failed: no Baitly persistence receipt (PUBACK is insufficient)", file=sys.stderr)
            return 1
        if outcome["status"] != 200:
            print("SIMULATION rejected: MQTT receipt", outcome["status"], file=sys.stderr)
            return 1
        print("SIMULATION: MQTT persisted", json.dumps(outcome))
        return 0
    finally:
        client.disconnect()
        client.loop_stop()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8095")
    parser.add_argument("--transport", choices=["http", "mqtt"], default="http")
    parser.add_argument("--mqtt-host", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=8883)
    parser.add_argument("--ca-file", help="CA that signed the MQTT server certificate")
    parser.add_argument("--cert-file", help="Individual device certificate, CN = SHA-256 of its current token")
    parser.add_argument("--key-file", help="Individual device private key")
    parser.add_argument("--level", type=float, required=True, help="Synthetic LAeq in dB(A)")
    parser.add_argument("--window-seconds", type=int, default=10)
    parser.add_argument("--event-id", type=uuid.UUID, default=None)
    parser.add_argument("--measured-at", help="UTC integration window end, ISO 8601")
    args = parser.parse_args()
    if args.transport == "mqtt" and (not all((args.ca_file, args.cert_file, args.key_file))
                                      or not 1 <= args.mqtt_port <= 65535):
        parser.error("MQTT requires --ca-file, --cert-file, --key-file and a valid TLS port")
    target = urllib.parse.urlsplit(args.url)
    loopback = target.hostname in ("localhost", "127.0.0.1", "::1")
    if not target.hostname or target.username or target.password or target.query or target.fragment:
        parser.error("Invalid server URL")
    if target.scheme != "https" and not (target.scheme == "http" and loopback):
        parser.error("HTTPS required outside loopback")
    token = os.environ.get("BAITLY_IOT_DEVICE_TOKEN", "")
    if not token or any(character.isspace() for character in token):
        parser.error("Set BAITLY_IOT_DEVICE_TOKEN to the device credential returned at registration")
    if not math.isfinite(args.level) or not 0 <= args.level <= 150 or not 1 <= args.window_seconds <= 300:
        parser.error("Level must be finite and within 0..150, window within 1..300 seconds")
    measured_at = args.measured_at or datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
    payload = {
        "eventId": str(args.event_id or uuid.uuid4()),
        "measuredAt": measured_at,
        "windowSeconds": args.window_seconds,
        "laeqDbA": args.level,
    }
    if args.transport == "mqtt":
        try:
            return send_mqtt(args, token, payload)
        except ImportError:
            print("Install scripts/requirements.txt to use MQTT simulation", file=sys.stderr)
        except (OSError, ValueError):
            print("SIMULATION failed: MQTT connection, certificate or TLS error", file=sys.stderr)
        return 1
    request = urllib.request.Request(
        args.url.rstrip("/") + "/api/v1/measurements",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=10) as response:
            print("SIMULATION:", response.status, response.read(4096).decode("utf-8"))
        return 0
    except urllib.error.HTTPError as error:
        print("SIMULATION rejected: HTTP", error.code, file=sys.stderr)
    except urllib.error.URLError:
        print("SIMULATION failed: connection or TLS error", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
