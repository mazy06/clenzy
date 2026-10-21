"""Baitly: bounded factual enrichment from individually reviewed official websites.

No discovery crawl, third-party directories, photos, reviews or marketing consent.
Unreviewed domains and changed terms fail closed. This mutates no database.
"""
import argparse
import copy
import hashlib
import http.client
import ipaddress
import json
import re
import socket
import ssl
import time
import unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urljoin, unquote
from urllib.robotparser import RobotFileParser

from build_baitly_saudi_public_snapshot import email, phone, COMBINED_LICENCE

AGENT = "BaitlyDirectory/1.0"
LICENCE = "Public business facts; reviewed website conditions"
SERVICES = {"CLEANING", "LAUNDRY", "MAINTENANCE", "EXTERIOR", "REPAIRS", "SECURITY",
            "PEST_CONTROL", "MOVING", "CONCIERGE", "PROPERTY_EXPERTS", "CATERING"}


def normalized(value):
    return " ".join(re.sub(r"[^\w]+", " ", unicodedata.normalize("NFKC", value).casefold()).split())


def checked_url(url, hosts):
    p = urlsplit(url)
    if p.scheme != "https" or p.hostname not in hosts or p.username or p.password or p.port not in (None, 443) \
            or p.query or p.fragment or any(c in unquote(url) for c in ("\r", "\n", "\\")):
        raise ValueError("UNAPPROVED_URL")
    try:
        ipaddress.ip_address(p.hostname)
    except ValueError:
        return p
    raise ValueError("IP_LITERAL")


class PinnedHttps(http.client.HTTPSConnection):
    def __init__(self, host, address):
        super().__init__(host, timeout=15, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            sock.close()
            raise


class Fetcher:
    def __init__(self):
        self.addresses = {}
        self.last = {}

    def get(self, url, hosts, delay=1, allowed=lambda url: True):
        for _ in range(4):
            p = checked_url(url, hosts)
            if not allowed(url):
                raise ValueError("ROBOTS_DISALLOWED")
            if p.hostname not in self.addresses:
                addresses = {r[4][0] for r in socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)}
                if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
                    raise ValueError("NON_PUBLIC_ADDRESS")
                self.addresses[p.hostname] = sorted(addresses)[0]
            if delay > 60:
                raise ValueError("ROBOTS_RATE_REQUIRES_DEFERRED_WORKER")
            time.sleep(max(0, self.last.get(p.hostname, 0) + max(1, delay) - time.monotonic()))
            connection = PinnedHttps(p.hostname, self.addresses[p.hostname])
            try:
                connection.request("GET", p.path or "/", headers={"User-Agent": AGENT, "Accept": "text/html,text/plain", "Accept-Encoding": "identity"})
                response = connection.getresponse()
                if response.status in (301, 302, 303, 307, 308):
                    url = urljoin(url, response.getheader("Location", ""))
                    continue
                body = response.read(524289)
                if len(body) > 524288:
                    raise ValueError("PAGE_TOO_LARGE")
                kind = response.getheader("Content-Type", "").lower()
                if response.status == 200 and not any(t in kind for t in ("text/html", "text/plain", "application/xhtml+xml")):
                    raise ValueError("UNSUPPORTED_CONTENT")
                return response.status, body.decode("utf-8", errors="replace"), url
            finally:
                self.last[p.hostname] = time.monotonic()
                connection.close()
        raise ValueError("TOO_MANY_REDIRECTS")


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.words, self.links = [], []
        self.feed(html)
        self.text = " ".join(self.words)

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.hidden += 1
        if tag == "a" and not self.hidden:
            self.links.append(dict(attrs).get("href", ""))

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden and data.strip():
            self.words.append(data.strip())


def policy_hash(text):
    return hashlib.sha256(normalized(Page(text).text).encode()).hexdigest()


def collect(policy, fetch, now):
    if policy.get("decision") != "REVIEWED_PUBLIC_BUSINESS_FACTS" or datetime.fromisoformat(policy["expiresAt"]).astimezone(timezone.utc) <= now:
        raise ValueError("REUSE_REVIEW_REQUIRED")
    reviewed = datetime.fromisoformat(policy["reviewedAt"]).astimezone(timezone.utc)
    expires = datetime.fromisoformat(policy["expiresAt"]).astimezone(timezone.utc)
    if reviewed > now or (expires-reviewed).total_seconds() > 90*86400 \
            or not 1 <= len(policy["hosts"]) <= 3 or not 1 <= len(policy["pages"]) <= 3 \
            or not 1 <= len(policy["conditions"]) <= 3:
        raise ValueError("INVALID_REUSE_REVIEW")
    hosts = set(policy["hosts"])
    robots = {}
    audit = []
    for host in sorted(hosts):
        url = "https://" + host + "/robots.txt"
        status, body, final = fetch.get(url, hosts)
        if status not in (200, 404):
            raise ValueError("ROBOTS_UNAVAILABLE")
        parser = RobotFileParser()
        parser.parse(body.splitlines() if status == 200 else [])
        robots[host] = parser
        audit.append({"url": final, "status": status, "sha256": hashlib.sha256(body.encode()).hexdigest()})

    pages = {}
    def page(url):
        if url in pages:
            return pages[url]
        p = checked_url(url, hosts)
        robot = robots[p.hostname]
        if not robot.can_fetch(AGENT, url):
            raise ValueError("ROBOTS_DISALLOWED")
        rate=robot.request_rate(AGENT)
        delay=max(robot.crawl_delay(AGENT) or 1,rate.seconds/rate.requests if rate and rate.requests else 1)
        status, body, final = fetch.get(url, hosts, delay,
                                      allowed=lambda target: robots[urlsplit(target).hostname].can_fetch(AGENT, target))
        if status != 200 or not robots[urlsplit(final).hostname].can_fetch(AGENT, final):
            raise ValueError("PAGE_UNAVAILABLE_OR_DISALLOWED")
        audit.append({"url": final, "sha256": hashlib.sha256(body.encode()).hexdigest()})
        pages[url] = (Page(body), final, body)
        return pages[url]

    for condition in policy["conditions"]:
        _, _, body = page(condition["url"])
        if policy_hash(body) != condition["sha256"]:
            raise ValueError("CONDITIONS_CHANGED")
    found = {"phone": {}, "email": {}, "services": {}, "offerings": []}
    review = []
    for url in policy["pages"]:
        parsed, final, _ = page(url)
        text = normalized(parsed.text)
        if not any(normalized(name) in text for name in policy["names"]) or not all(normalized(token) in text for token in policy["locationTokens"]):
            raise ValueError("WEBSITE_IDENTITY_REQUIRES_REVIEW")
        # Follow no links: only the reviewed pages above. Never collect account/form input.
        values = [link[7:].split("?")[0] for link in parsed.links if link.startswith("mailto:")]
        values += re.findall(r"[^\s@<>\";,]+@[^\s@<>\";,]+\.[A-Za-z]{2,}", parsed.text)
        for raw in values:
            value = email(raw)
            if value and value.rsplit("@", 1)[1] in policy["emailDomains"]:
                found["email"][value] = final
            elif value:
                review.append({"field": "email", "value": value, "url": final, "reason": "UNVERIFIED_EMAIL_DOMAIN"})
        values = [link[4:] for link in parsed.links if link.startswith("tel:")]
        values += re.findall(r"(?<!\d)(?:\+212|00212|0)[\s.()-]*[5-8](?:[\s.()-]*\d){8}(?!\d)", parsed.text)
        for raw in values:
            value = phone(raw, "MA")
            if value:
                found["phone"][value] = final
        for item in policy.get("services", []):
            if item["service"] not in SERVICES:
                raise ValueError("UNKNOWN_SERVICE")
            if normalized(item["affirmation"]) in text:
                found["services"][item["service"]] = final
                found["offerings"].append({"service": item["service"], "label": item["label"], "url": final})
    review=list({json.dumps(item,sort_keys=True):item for item in review}.values())
    found["offerings"]=list({(item["service"],item["label"]):item for item in found["offerings"]}.values())
    return found, review, audit


def enrich(rows, policies, fetch, now):
    result = copy.deepcopy(rows)
    reviews, reports = [], []
    for policy in policies:
        keys = set(policy["identities"])
        matches = [r for r in result if "MA:"+r["identifierType"]+":"+r["identifier"] in keys]
        if len(matches) != 1 or urlsplit(matches[0].get("website", "")).hostname not in policy["hosts"]:
            reports.append({"policy": policy["id"], "status": "IDENTITY_UNRESOLVED"})
            continue
        row = matches[0]
        try:
            found, pending, audit = collect(policy, fetch, now)
            reviews.extend(dict(p, policy=policy["id"]) for p in pending)
            filled = {}
            for field in ("phone", "email"):
                candidates = found[field]
                if len(candidates) == 1 and not row.get(field):
                    value, url = next(iter(candidates.items()))
                    row[field] = value
                    filled[field] = {"value": value, "url": url}
                    row.setdefault("mergedFieldSources", {})[field] = "WEBSITE:"+url
                elif candidates and (len(candidates) > 1 or row.get(field) not in candidates):
                    reviews.append({"policy": policy["id"], "field": field, "reason": "AMBIGUOUS_OR_CONFLICTING_CONTACT", "candidates": candidates})
            services = sorted(found["services"])
            if filled or services:
                row["websiteServices"] = services
                proof = {"source": "WEBSITE", "identifier": row["identifier"], "url": policy["pages"][0],
                         "licence": LICENCE, "retrievedAt": now.isoformat(), "policyId": policy["id"],
                         "policyRevision": policy["revision"], "reuseBasis": policy["decision"],
                         "reviewedAt": policy["reviewedAt"], "expiresAt": policy["expiresAt"],
                         "fields": filled, "services": found["services"], "offerings": found["offerings"], "checks": audit}
                for field, item in filled.items():
                    proof[field] = item["value"]
                row["sourceEvidence"].append(proof)
            reports.append({"policy": policy["id"], "status": "VERIFIED", "filled": sorted(filled), "services": services})
        except (ValueError, OSError, http.client.HTTPException) as failure:
            reports.append({"policy": policy["id"], "status": "SKIPPED", "reason": str(failure)[:160]})
    return result, reviews, reports


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--policies", type=Path, default=Path(__file__).parent/"morocco_website_policies.json")
    args = parser.parse_args()
    root = json.loads((args.out/"latest.json").read_text())
    manifest = root["manifest"]
    if manifest["country"] != "MA" or manifest["source"] != "MA_PUBLIC" or manifest["licence"] != COMBINED_LICENCE:
        raise ValueError("VERIFIED_MOROCCO_EDITION_REQUIRED")
    original = args.out/("public-"+manifest["sha256"]+".jsonl")
    body = original.read_bytes()
    if len(body) != root["bytes"] or hashlib.sha256(body).hexdigest() != manifest["sha256"]:
        raise ValueError("SOURCE_CHECKSUM_MISMATCH")
    rows = [json.loads(line) for line in body.splitlines()]
    if len(rows) != manifest["count"] or any(e["source"] == "WEBSITE" for r in rows for e in r["sourceEvidence"]):
        raise ValueError("FRESH_BASE_EDITION_REQUIRED")
    policies = json.loads(args.policies.read_text())["policies"]
    if len(policies) > 1000 or len({p["id"] for p in policies}) != len(policies):
        raise ValueError("POLICY_BOUNDS_OR_DUPLICATE")
    identities=[key for policy in policies for key in policy["identities"]]
    if len(identities)!=len(set(identities)):
        raise ValueError("OVERLAPPING_WEBSITE_POLICIES")
    now = datetime.now(timezone.utc)
    rows, reviews, report = enrich(rows, policies, Fetcher(), now)
    body = "".join(json.dumps(r, ensure_ascii=False)+"\n" for r in rows).encode()
    digest = hashlib.sha256(body).hexdigest()
    target = args.out/("public-"+digest+".jsonl")
    part = target.with_suffix(".partial");part.write_bytes(body);part.replace(target)
    manifest.update(sha256=digest, version="public-"+digest, retrievedAt=now.isoformat())
    root["bytes"] = len(body)
    root["websiteEnrichment"] = {"policiesSha256": hashlib.sha256(args.policies.read_bytes()).hexdigest(), "report": report}
    notice = args.out/"licenses/WEBSITE-FACTS-NOTICE.txt"
    notice.parent.mkdir(exist_ok=True)
    notice.write_text("Baitly: business contact and service facts collected from individually reviewed official websites. "
                      "Website-derived facts are identified separately by WEBSITE evidence and their own reviewed conditions; "
                      "the OSM/Overture licences do not grant rights to website texts, photos, reviews or logos. "
                      "No marketing consent is inferred. Each field retains its source URL and retrieval date.\n")
    root.setdefault("licenceDocuments", [])
    root["licenceDocuments"] = sorted(set(root["licenceDocuments"]+["licenses/"+notice.name]))
    (args.out/"website-review.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False)+"\n" for r in reviews))
    (args.out/"website-report.json").write_text(json.dumps(root["websiteEnrichment"], ensure_ascii=False, indent=2))
    temporary = args.out/"latest.partial";temporary.write_text(json.dumps(root, ensure_ascii=False));temporary.replace(args.out/"latest.json")
    print(json.dumps(root["websiteEnrichment"], ensure_ascii=False))


if __name__ == "__main__":
    main()
