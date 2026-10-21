import copy
import unittest
from build_baitly_saudi_public_snapshot import project, merge, SOURCE_URL

ID="cd9acfa1-6f6e-40ab-8e0c-8f188d4ea776"

def feature():
    return {"id":ID,"geometry":{"type":"Point","coordinates":[46.7,24.7]},"properties":{
        "names":{"primary":"مغسلة"},"taxonomy":{"primary":"dry_cleaning"},"confidence":0.9,
        "addresses":[{"country":"SA","freeform":"10 Street","locality":"Riyadh","postcode":"12211"}],
        "phones":["invalid","0112345678"],"emails":["info@example.org"],"websites":["https://example.org"],
        "sources":[{"license":"CDLA-Permissive-2.0","dataset":"meta","record_id":"42"}]}}

def osm():
    return {"identifierType":"OSM","identifier":"node/42","active":True,"name":"مغسلة","service":"LAUNDRY",
        "address":"10 Street","city":"Riyadh","postalCode":"12211","activity":"",
        "latitude":24.7,"longitude":46.7,"phone":"","email":"","website":""}

class SaudiPublicTest(unittest.TestCase):
    def test_scope_confidence_country_and_licence_are_fail_closed(self):
        row=project(feature(),lambda x,y:True,"2026-09-23.1")
        self.assertEqual(row["phone"],"+966112345678")
        self.assertEqual(row["identifierType"],"OVERTURE")
        self.assertEqual(row["sourceUrl"],SOURCE_URL)
        for key,value in [("confidence",0.49),("operating_status","permanently_closed"),("taxonomy",{"primary":"automotive_repair"}),("sources",[{"license":None}]),("addresses",[{"country":"AE"}])]:
            f=feature();f["properties"][key]=value
            self.assertIsNone(project(f,lambda x,y:True,"test"),key)
        self.assertIsNone(project(feature(),lambda x,y:False,"test"))

    def test_verified_taxonomy_aliases_and_restaurant_hierarchy_match_existing_osm_scope(self):
        for category,service in [("hvac_service","MAINTENANCE"),("mover","MOVING"),("key_and_locksmith","SECURITY"),("restaurant","CATERING")]:
            f=feature();f["properties"].update(confidence=0.5,taxonomy={"primary":category})
            self.assertEqual(project(f,lambda x,y:True,"test")["service"],service)
        f=feature();f["properties"]["taxonomy"]={"primary":"lebanese_restaurant","hierarchy":["food_and_drink","restaurant","lebanese_restaurant"]}
        self.assertEqual(project(f,lambda x,y:True,"test")["service"],"CATERING")
        f["properties"]["taxonomy"]={"primary":"automotive_repair","hierarchy":["services_and_business","vehicle_service","automotive_repair"]}
        self.assertIsNone(project(f,lambda x,y:True,"test"))

    def test_exact_match_keeps_osm_identity_contact_and_both_evidences(self):
        original=osm();original["phone"]="+966511111111"
        rows,review=merge([original],[project(feature(),lambda x,y:True,"test")])
        self.assertEqual(len(rows),1);self.assertEqual(review,[])
        kept=rows[0]
        self.assertEqual(kept["identifier"],"node/42")
        self.assertEqual(kept["phone"],original["phone"])
        self.assertEqual(kept["email"],"info@example.org")
        self.assertEqual(kept["identifiers"]["OVERTURE"],ID)
        self.assertEqual([e["source"] for e in kept["sourceEvidence"]],["OSM","OVERTURE"])
        self.assertEqual(kept["mergedFieldSources"]["email"],"OVERTURE:"+ID)
        self.assertNotIn("baseSource",original)

    def test_ambiguous_matches_do_not_merge_or_publish_duplicate(self):
        a,b=osm(),osm();b["identifier"]="way/43"
        rows,review=merge([a,b],[project(feature(),lambda x,y:True,"test")])
        self.assertEqual(len(rows),2);self.assertEqual(len(review),1)
        self.assertTrue(all(not r.get("email") for r in rows))
        self.assertEqual(review[0]["reason"],"AMBIGUOUS_OSM_MATCH")

    def test_translated_name_needs_exact_phone_and_domain_at_same_establishment(self):
        original=osm();original.update(phone="+966112345678",website="https://example.org",name="Laundry")
        rows,review=merge([original],[project(feature(),lambda x,y:True,"test")])
        self.assertEqual(len(rows),1);self.assertEqual(review,[])
        original["website"]="https://other.example.org"
        rows,review=merge([original],[project(feature(),lambda x,y:True,"test")])
        self.assertEqual(len(rows),1);self.assertEqual(len(review),1)

    def test_separate_branches_stay_separate_and_reruns_are_deterministic(self):
        row=project(feature(),lambda x,y:True,"test");row["latitude"]=25
        first=merge([osm()],[copy.deepcopy(row)])
        self.assertEqual(len(first[0]),2)
        self.assertEqual(first,merge([osm()],[copy.deepcopy(row)]))
        rows,review=merge([], [row,copy.deepcopy(row)])
        self.assertEqual(len(rows),1)

if __name__=="__main__":unittest.main()
