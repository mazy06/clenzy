"""Public country professional edition from OSM; no registry credentials or tenant data."""
import argparse
import hashlib
import json
import math
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from baitly_national_import import resource, download

SOURCE = "https://download.geofabrik.de/asia/gcc-states-latest.osm.pbf"
SOURCES = {"SA": SOURCE, "MA": "https://download.geofabrik.de/africa/morocco-latest.osm.pbf"}
LICENCE = "https://www.openstreetmap.org/copyright"
# Exact public activity tags only; never infer a trade from an establishment's name.
SERVICES = {
    "shop": {"laundry": "LAUNDRY", "dry_cleaning": "LAUNDRY", "carpet": "PROPERTY_EXPERTS"},
    "craft": {"cleaning": "CLEANING", "carpet_cleaning": "CLEANING", "window_cleaning": "CLEANING",
              "electrician": "MAINTENANCE", "plumber": "MAINTENANCE", "hvac": "MAINTENANCE",
              "carpenter": "MAINTENANCE", "painter": "MAINTENANCE", "locksmith": "SECURITY",
              "gardener": "EXTERIOR", "pest_control": "PEST_CONTROL", "caterer": "CATERING",
              "electronics_repair": "REPAIRS", "appliance_repair": "REPAIRS"},
    "office": {"property_management": "CONCIERGE", "security": "SECURITY", "moving_company": "MOVING",
               "architect": "PROPERTY_EXPERTS", "interior_design": "PROPERTY_EXPERTS"},
    "amenity": {"restaurant": "CATERING", "cafe": "CATERING", "fast_food": "CATERING"},
}
CONTACT_KEYS = ("phone", "mobile", "email", "website", "contact:phone", "contact:mobile", "contact:email", "contact:website")
TAG_KEYS = {"name", "name:ar", "name:en", "name:fr", "brand", "addr:country", "addr:city", "addr:town", "addr:village",
            "addr:housenumber", "addr:street", "addr:place", "addr:postcode", *SERVICES, *CONTACT_KEYS}


def ring_contains(ring, x, y):
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        ax, ay = a[:2]
        bx, by = b[:2]
        if abs((x-ax)*(by-ay)-(y-ay)*(bx-ax)) < 1e-10 and min(ax,bx)-1e-10 <= x <= max(ax,bx)+1e-10 and min(ay,by)-1e-10 <= y <= max(ay,by)+1e-10:
            return True
        if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
            inside = not inside
    return inside


def contains(polygons, lon, lat):
    if callable(polygons):
        return polygons(lon, lat)
    return any(ring_contains(p[0], lon, lat) and not any(ring_contains(h, lon, lat) for h in p[1:]) for p in polygons)


def representative(polygons):
    # Keep a point on the actual geometry if its bounding-box centre falls outside it.
    ring = max(polygons, key=lambda p: len(p[0]))[0]
    lon = (min(p[0] for p in ring) + max(p[0] for p in ring))/2
    lat = (min(p[1] for p in ring) + max(p[1] for p in ring))/2
    return (lon, lat) if contains(polygons, lon, lat) else tuple(ring[0][:2])


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFKC", value).casefold() if c.isalnum())


def clean(value):
    return " ".join("".join(" " if ord(c)<32 else c for c in value).split())


def fits(value, maximum):
    # Match Java/JDBC field validation for non-BMP characters too.
    return len(value.encode("utf-16-le"))//2 <= maximum


def project(kind, identifier, tags, lon, lat, boundary, country="SA"):
    if tags.get("addr:country", country).upper() not in (country, {"SA":"SAU", "MA":"MAR"}[country]):
        return None
    if any(tags.get(k) in ("yes", "true", "1") for k in ("disused", "abandoned", "demolished", "closed")) or tags.get("opening_hours") == "closed":
        return None
    service = next((choices[tags.get(key)] for key, choices in SERVICES.items() if tags.get(key) in choices), None)
    name = next((clean(tags[k]) for k in ("name", "name:fr", "name:ar", "name:en") if clean(tags.get(k, ""))), "")
    if not service or not name or not fits(name,200):
        return None
    if not all(math.isfinite(v) for v in (lon, lat)) or not contains(boundary, lon, lat):
        return None
    def contact(key, maximum):
        keys = ("contact:phone", "phone", "contact:mobile", "mobile") if key == "phone" else ("contact:"+key, key)
        return next((tags[k].strip() for k in keys if tags.get(k, "").strip() and len(tags[k].strip()) <= maximum), "")
    address = clean(" ".join(tags.get(k, "") for k in ("addr:housenumber", "addr:street", "addr:place")))
    city = next((clean(tags[k]) for k in ("addr:city", "addr:town", "addr:village") if clean(tags.get(k, ""))), "")
    postcode = clean(tags.get("addr:postcode", ""))
    if not fits(address,500) or not fits(city,120) or not fits(postcode,10):
        return None
    return {"active": True, "identifierType": "OSM", "identifier": f"{kind}/{identifier}", "name": name,
            "address": address, "city": city, "postalCode": postcode, "activity": "", "service": service,
            "latitude": lat, "longitude": lon, "phone": contact("phone", 80), "email": contact("email", 254),
            "website": contact("website", 500), "osmSources": [f"{kind}/{identifier}"],
            "tags": {k:v for k,v in tags.items() if k in TAG_KEYS and len(v) <= 500}}


def extract(path, output, country_code="SA"):
    import osmium
    from shapely.geometry import shape, Point
    from shapely.prepared import prep
    geometry = osmium.geom.GeoJSONFactory()
    class Boundary(osmium.SimpleHandler):
        polygons = None
        def area(self, area):
            if area.tags.get("ISO3166-1", area.tags.get("ISO3166-1:alpha2", "")) == country_code and area.tags.get("admin_level") == "2":
                self.polygons = json.loads(geometry.create_multipolygon(area))["coordinates"]
    national = Boundary()
    national.apply_file(str(path), locations=True)
    if not national.polygons:
        raise ValueError("National boundary missing; refusing to publish a cross-country edition")
    country = shape({"type":"MultiPolygon", "coordinates":national.polygons})
    if not country.is_valid or country.is_empty:
        raise ValueError("Invalid national boundary")
    output.with_name(country_code.lower()+"-boundary.geojson").write_text(json.dumps({"type":"MultiPolygon", "coordinates":national.polygons}), encoding="utf-8")
    prepared = prep(country)
    # SQLite bounds memory and deterministically removes exact duplicate objects/locations.
    import sqlite3
    spool = output.with_suffix(".sqlite")
    spool.unlink(missing_ok=True)
    db = sqlite3.connect(spool)
    db.execute("CREATE TABLE entries (id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE, payload TEXT NOT NULL)")
    class Professionals(osmium.SimpleHandler):
        def save(self, kind, identifier, tags, lon, lat):
            row = project(kind, identifier, dict(tags), lon, lat, lambda x,y: prepared.covers(Point(x,y)), country_code)
            if row:
                fingerprint = json.dumps([normalize(row["name"]), round(lat,6), round(lon,6)], ensure_ascii=False)
                existing = db.execute("SELECT id,payload FROM entries WHERE fingerprint=?",(fingerprint,)).fetchone()
                if existing:
                    # Exact same normalized name and position only. Never merge nearby branches by phone.
                    kept = json.loads(existing[1])
                    kept["osmSources"] = sorted(set(kept["osmSources"]+row["osmSources"]))
                    for key in ("phone","email","website","address","city","postalCode"):
                        if not kept[key] and row[key]:
                            kept[key] = row[key]
                            kept.setdefault("mergedFieldSources",{})[key] = row["identifier"]
                    db.execute("UPDATE entries SET payload=? WHERE id=?",(json.dumps(kept,ensure_ascii=False),existing[0]))
                else:
                    db.execute("INSERT OR IGNORE INTO entries VALUES (?,?,?)", (row["identifier"], fingerprint, json.dumps(row, ensure_ascii=False)))
        def node(self, obj):
            if any(obj.tags.get(k) in choices for k,choices in SERVICES.items()) and obj.location.valid():
                self.save("node", obj.id, obj.tags, obj.location.lon, obj.location.lat)
        def way(self, obj):
            if not any(obj.tags.get(k) in choices for k,choices in SERVICES.items()):
                return
            points = [(n.lon,n.lat) for n in obj.nodes if n.location.valid()]
            if len(points) != len(obj.nodes) or not points:
                return
            lon = (min(p[0] for p in points)+max(p[0] for p in points))/2
            lat = (min(p[1] for p in points)+max(p[1] for p in points))/2
            if obj.is_closed() and len(points) >= 4:
                lon,lat = representative([[points]])
            self.save("way", obj.id, obj.tags, lon, lat)
        def area(self, obj):
            if obj.from_way() or not any(obj.tags.get(k) in choices for k,choices in SERVICES.items()):
                return
            polygons = json.loads(geometry.create_multipolygon(obj))["coordinates"]
            lon,lat = representative(polygons)
            self.save("relation", obj.orig_id(), obj.tags, lon, lat)
    try:
        Professionals().apply_file(str(path), locations=True)
        db.commit()
        count = db.execute("SELECT count(*) FROM entries").fetchone()[0]
        if not count:
            raise ValueError("Empty national OSM edition")
        temporary = output.with_suffix(".partial")
        with temporary.open("w", encoding="utf-8") as stream:
            for (payload,) in db.execute("SELECT payload FROM entries ORDER BY id"):
                stream.write(payload+"\n")
        temporary.replace(output)
        return count
    finally:
        db.close()
        spool.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", choices=sorted(SOURCES), default="SA")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--input", type=Path, help="Existing local GCC PBF, for reproducible offline extraction")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    source = None
    path = args.input
    if path is None:
        source = resource(SOURCES[args.country], {"download.geofabrik.de"})
        path = args.out / (args.country.lower()+".osm.pbf")
        download(source, path)
    output = args.out / (args.country.lower()+".jsonl")
    count = extract(path, output, args.country)
    with output.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    immutable = output.with_name(f"osm-{digest}.jsonl")
    output.replace(immutable)
    manifest = {"country":args.country, "source":"OSM", "mode":"osm", "version":"osm-"+digest,
                "sha256":digest, "count":count, "sourceUrl":LICENCE, "licence":"ODbL 1.0",
                "retrievedAt":datetime.now(timezone.utc).isoformat(), "complete":True, "publishable":True}
    (args.out/"latest.json").write_text(json.dumps({"manifest":manifest, "bytes":immutable.stat().st_size,
        "sources":[source] if source else [], "attribution":"© OpenStreetMap contributors"}), encoding="utf-8")
    (args.out/"osm-latest.json").write_bytes((args.out/"latest.json").read_bytes())
    print(f"{args.country} OSM professionals: {count}")


if __name__ == "__main__":
    main()
