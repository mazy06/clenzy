"""Baitly country public edition: exact activity mapping, OSM-first evidence and bounded matching."""
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from build_baitly_saudi_osm_snapshot import clean, fits, normalize

SOURCE_URL = "https://docs.overturemaps.org/guides/places/"
LICENCES = {"CDLA-Permissive-2.0", "Apache-2.0", "CC0-1.0"}
COMBINED_LICENCE = "ODbL 1.0; CDLA-Permissive-2.0; Apache-2.0; CC0-1.0"
# Exact taxonomy only. No automotive, healthcare, industrial or broad office categories.
SERVICES = {
    "home_cleaning":"CLEANING", "cleaning_service":"CLEANING", "janitorial_service":"CLEANING",
    "dry_cleaning":"LAUNDRY", "laundromat":"LAUNDRY", "laundry_service":"LAUNDRY",
    "pest_control_service":"PEST_CONTROL", "landscaping":"EXTERIOR", "pool_cleaning":"EXTERIOR",
    "appliance_repair_service":"REPAIRS", "electrician":"MAINTENANCE", "plumbing":"MAINTENANCE",
    "plumber":"MAINTENANCE", "handyman":"MAINTENANCE", "air_conditioning_service":"MAINTENANCE",
    "heating_and_air_conditioning":"MAINTENANCE", "locksmith":"SECURITY",
    "moving_company":"MOVING", "property_management":"CONCIERGE", "caterer":"CATERING",
    "interior_design":"PROPERTY_EXPERTS",
    "hvac_service":"MAINTENANCE", "key_and_locksmith":"SECURITY", "mover":"MOVING",
    "carpenter":"MAINTENANCE", "painting":"MAINTENANCE", "roofing":"MAINTENANCE",
    "flooring_contractor":"MAINTENANCE", "windows_installation":"MAINTENANCE",
    "furniture_assembly":"MAINTENANCE", "electronics_repair_shop":"REPAIRS",
    "home_security":"SECURITY", "security_systems":"SECURITY", "gardener":"EXTERIOR",
    "architect":"PROPERTY_EXPERTS", "architectural_designer":"PROPERTY_EXPERTS",
    # Same restaurant/cafe scope as the existing Saudi OSM edition.
    "restaurant":"CATERING", "fast_food_restaurant":"CATERING", "cafe":"CATERING", "coffee_shop":"CATERING",
}
MIN_CONFIDENCE = 0.5

def phone(value, country="SA"):
    value = re.sub(r"[\s().-]", "", value or "")
    if country == "MA":
        if value.startswith("00212"): value = "+" + value[2:]
        if re.fullmatch(r"0[5-8][0-9]{8}", value): value = "+212" + value[1:]
        return value if re.fullmatch(r"\+212[5-8][0-9]{8}", value) else ""
    if value.startswith("00966"):
        value = "+" + value[2:]
    if re.fullmatch(r"0[15][0-9]{8}", value):
        value = "+966" + value[1:]
    return value if re.fullmatch(r"\+966[1-9][0-9]{8}", value) else ""

def email(value):
    value = (value or "").strip().lower()
    return value if len(value)<=254 and re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", value) else ""

def website(value):
    try:
        parsed = urlsplit(value or "")
        host = parsed.hostname or ""
        return value if parsed.scheme == "https" and "." in host and not parsed.username and not parsed.password and not re.fullmatch(r"[0-9.]+", host) and not host.endswith((".local", ".localhost")) and len(value)<=500 else ""
    except ValueError:
        return ""

def first(values, validator):
    return next((valid for v in values or [] if isinstance(v, str) and (valid := validator(v))), "")

def project(feature, boundary, release, country="SA"):
    p = feature.get("properties") or {}
    taxonomy=p.get("taxonomy") or {}
    categories=[taxonomy.get("primary"),*reversed(taxonomy.get("hierarchy") or []),p.get("basic_category")]
    service=next((SERVICES[c] for c in categories if c in SERVICES),None)
    if not service or not isinstance(p.get("confidence"), (int,float)) or not math.isfinite(p["confidence"]) or not MIN_CONFIDENCE <= p["confidence"] <= 1:
        return None
    if p.get("operating_status") not in (None, "open"):
        return None
    try:
        identifier = str(UUID(feature["id"]))
        if identifier != feature["id"] or feature["geometry"]["type"] != "Point":
            return None
        lon, lat = feature["geometry"]["coordinates"]
        if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (lon, lat)) or not boundary(lon,lat):
            return None
    except (KeyError, ValueError, TypeError):
        return None
    sources = p.get("sources") or []
    # A null or unknown upstream licence is not silently treated as permissive.
    if not sources or any(s.get("license") not in LICENCES for s in sources):
        return None
    addresses = [a for a in p.get("addresses") or [] if a.get("country") == country]
    if not addresses:
        return None
    a = addresses[0]
    name = clean((p.get("names") or {}).get("primary") or "")
    address, city, postal = (clean(a.get(k) or "") for k in ("freeform","locality","postcode"))
    if not name or not fits(name,200) or not fits(address,500) or not fits(city,120):
        return None
    # Keep only valid Saudi postcodes. Never truncate identifiers or guess a street.
    postal = postal if re.fullmatch(r"[0-9]{5}(?:-[0-9]{4})?", postal) else ""
    return {"active":True, "identifierType":"OVERTURE", "identifier":identifier,
        "baseSource":"OVERTURE", "sourceUrl":SOURCE_URL, "sourceLicence":"; ".join(sorted({s["license"] for s in sources})),
        "name":name,"address":address,"city":city,"postalCode":postal,"activity":"","service":service,
        "latitude":lat,"longitude":lon,"phone":first(p.get("phones"),lambda v: phone(v,country)),
        "email":first(p.get("emails"),email),"website":first(p.get("websites"),website),
        "identifiers":{"OVERTURE":identifier},
        "overture":{"id":identifier,"release":release,"confidence":p["confidence"],
            "taxonomy":p.get("taxonomy"),"sources":sources,"operatingStatus":p.get("operating_status")}}

def distance(a,b):
    lat1,lat2=math.radians(a["latitude"]),math.radians(b["latitude"])
    dlat=lat2-lat1;dlon=math.radians(b["longitude"]-a["longitude"])
    h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371000*2*math.asin(min(1,math.sqrt(h)))

def evidence(row):
    return {"source":row["baseSource"],"url":row["sourceUrl"],"licence":row["sourceLicence"],
        "identifier":row["identifier"],"phone":row.get("phone"),"email":row.get("email"),
        "website":row.get("website"),"overture":row.get("overture")}

def merge(osm, overture, country="SA"):
    phone_number = lambda value: phone(value, country)
    rows={}; by_name=defaultdict(list); by_phone=defaultdict(list); quarantined=[]
    for original in osm:
        row=dict(original,baseSource="OSM",sourceUrl="https://www.openstreetmap.org/"+original["identifier"],sourceLicence="ODbL 1.0")
        # Normalize before matching and filling blanks; malformed source contacts are not authoritative.
        row.update(phone=phone_number(row.get("phone")),email=email(row.get("email")),website=website(row.get("website")))
        row["identifiers"]={"OSM":row["identifier"]}
        row["sourceEvidence"]=[evidence(row)]
        rows[("OSM",row["identifier"])]=row
        by_name[normalize(row["name"])].append(row)
        if phone_number(row.get("phone")):by_phone[phone_number(row["phone"])].append(row)
    # Construct all candidate edges first: iteration order must not resolve ambiguous matches.
    edges={}; claims=defaultdict(list)
    for row in overture:
        candidates={r["identifier"]:r for r in by_name[normalize(row["name"])]+by_phone.get(phone_number(row.get("phone")),[])}
        nearby=[r for r in candidates.values() if distance(r,row)<=150]
        strong=[]
        for r in nearby:
            same_address=normalize(row["name"])==normalize(r["name"]) and bool(normalize(row["address"])) and normalize(row["address"])==normalize(r["address"])
            same_contact=bool(phone_number(row["phone"])) and phone_number(row["phone"])==phone_number(r.get("phone")) and bool(website(row["website"])) and urlsplit(row["website"]).hostname==urlsplit(r.get("website") or "").hostname
            if r["service"]==row["service"] and distance(r,row)<=50 and (same_address or same_contact and distance(r,row)<=10):
                strong.append(r)
        edges[row["identifier"]]=(nearby,strong)
        for r in strong:claims[r["identifier"]].append(row["identifier"])
    for row in sorted(overture,key=lambda r:r["identifier"]):
        nearby,strong=edges[row["identifier"]]
        if len(strong)==1 and len(claims[strong[0]["identifier"]])==1:
            kept=strong[0]
            kept["identifiers"]["OVERTURE"]=row["identifier"]
            kept["sourceEvidence"].append(evidence(row))
            kept["sourceLicence"]=COMBINED_LICENCE
            for field in ("phone","email","website"):
                if not kept.get(field) and row.get(field):
                    kept[field]=row[field]
                    kept.setdefault("mergedFieldSources",{})[field]="OVERTURE:"+row["identifier"]
        elif nearby:
            quarantined.append({"identifier":row["identifier"],"reason":"AMBIGUOUS_OSM_MATCH","candidates":[r["identifier"] for r in nearby],"record":row})
        else:
            # Same-name nearby Overture records also require review; no guessing between branches.
            previous=by_name[normalize(row["name"])]+by_phone.get(phone_number(row.get("phone")),[])
            if any(distance(r,row)<=150 for r in previous):
                quarantined.append({"identifier":row["identifier"],"reason":"AMBIGUOUS_OVERTURE_MATCH","record":row})
                continue
            row["sourceEvidence"]=[evidence(row)]
            rows[("OVERTURE",row["identifier"])]=row
            by_name[normalize(row["name"])].append(row)
            if phone_number(row.get("phone")):by_phone[phone_number(row["phone"])].append(row)
    return sorted(rows.values(),key=lambda r:(r["identifierType"],r["identifier"])),quarantined

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--country",choices=["MA","SA"],default="SA")
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--overture-input",type=Path)
    parser.add_argument("--release",help="Pinned release, defaults to official client latest")
    args=parser.parse_args();country=args.country;slug=country.lower();args.out.mkdir(parents=True,exist_ok=True)
    from shapely.geometry import shape,Point
    from shapely.prepared import prep
    national_shape=shape(json.loads((args.out/(slug+"-boundary.geojson")).read_text()))
    national=prep(national_shape)
    source=args.overture_input or args.out/("overture-"+slug+".geojsonseq")
    if not args.overture_input:
        command=["overturemaps","download","--bbox="+",".join(str(v) for v in national_shape.bounds),"--type=place","-f","geojsonseq","-o",str(source)]
        if args.release:command.extend(["--release",args.release])
        subprocess.run(command,check=True)
    state=source.with_name(source.name+".state")
    release=args.release or json.loads(state.read_text())["last_release"]
    if not re.fullmatch(r"20[0-9]{2}-[0-9]{2}-[0-9]{2}\.[0-9]+",release):
        raise ValueError("Unverified Overture release")
    osm_manifest=json.loads((args.out/"osm-latest.json").read_text())
    osm_path=args.out/("osm-"+osm_manifest["manifest"]["sha256"]+".jsonl")
    if hashlib.sha256(osm_path.read_bytes()).hexdigest()!=osm_manifest["manifest"]["sha256"]:
        raise ValueError("OSM checksum mismatch")
    selected=[];scanned=0;seen=set()
    with source.open() as stream:
        for line in stream:
            if not line.strip():continue
            scanned+=1
            row=project(json.loads(line.lstrip("\x1e")),lambda x,y:national.covers(Point(x,y)),release,country)
            if row:
                if row["identifier"] in seen:raise ValueError("Duplicate Overture source identity")
                seen.add(row["identifier"]);selected.append(row)
    # A failed/empty source must not publish an apparently complete combined edition.
    if scanned<1000 or not selected:raise ValueError("Empty or incomplete Overture national collection")
    osm=[json.loads(line) for line in osm_path.read_text().splitlines()]
    rows,review=merge(osm,selected,country)
    licences=args.out/"licenses";licences.mkdir(exist_ok=True)
    for text in (Path(__file__).parent/"licenses").glob("*.txt"):
        shutil.copyfile(text,licences/text.name)
    part=args.out/"public.partial"
    with part.open("w",encoding="utf-8") as stream:
        for row in rows:stream.write(json.dumps(row,ensure_ascii=False)+"\n")
    with part.open("rb") as stream:digest=hashlib.file_digest(stream,"sha256").hexdigest()
    immutable=args.out/("public-"+digest+".jsonl");part.replace(immutable)
    manifest={"country":country,"source":country+"_PUBLIC","mode":slug+"-public","version":"public-"+digest,
        "sha256":digest,"count":len(rows),"sourceUrl":SOURCE_URL,"licence":COMBINED_LICENCE,
        "retrievedAt":datetime.now(timezone.utc).isoformat(),"complete":True,"publishable":True}
    (args.out/"review.jsonl").write_text("".join(json.dumps(r,ensure_ascii=False)+"\n" for r in review))
    # Full collection has completed before publishing its manifest. The workflow uploads it last.
    (args.out/"latest.json").write_text(json.dumps({"manifest":manifest,"bytes":immutable.stat().st_size,
        "overtureRelease":release,"attribution":"© OpenStreetMap contributors; Overture Maps Foundation",
        "licenceDocuments":["licenses/"+p.name for p in sorted(licences.glob("*.txt"))],
        "statistics":{"scanned":scanned,"osm":len(osm),"overtureSelected":len(selected),
            "merged":sum(r["identifierType"]=="OSM" and "OVERTURE" in r["identifiers"] for r in rows),
            "overtureStandalone":sum(r["identifierType"]=="OVERTURE" for r in rows),"review":len(review)}}))
    print(json.dumps({"published":len(rows),"overtureSelected":len(selected),"review":len(review),"release":release}))

if __name__=="__main__":main()
