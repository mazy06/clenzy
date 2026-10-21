import json
import tempfile
import unittest
from pathlib import Path
from build_baitly_saudi_osm_snapshot import project, extract, contains

BOUNDARY = [[[[38,20],[50,20],[50,30],[38,30],[38,20]]]]


class SaudiOsmTest(unittest.TestCase):
    def test_scope_contacts_and_no_legal_identity_invented(self):
        row = project("node", 42, {"name":"مغسلة", "shop":"laundry", "phone":"+966112345678",
            "contact:email":"contact@example.org", "addr:city":"الرياض"}, 46.7,24.7,BOUNDARY)
        self.assertEqual(row["identifier"], "node/42")
        self.assertEqual(row["service"], "LAUNDRY")
        self.assertEqual(row["email"], "contact@example.org")
        self.assertEqual(row["phone"], "+966112345678")
        self.assertEqual(row["address"], "")
        self.assertNotIn("UNN", row)
        self.assertIsNone(project("node",42,{"name":"Test","shop":"laundry"},55.3,25.2,BOUNDARY))
        self.assertIsNone(project("node",42,{"name":"Test","shop":"laundry","addr:country":"AE"},46,24,BOUNDARY))
        self.assertIsNone(project("node",42,{"name":"Test","shop":"laundry","disused":"yes"},46,24,BOUNDARY))
        self.assertIsNone(project("node",42,{"name":"Cleaning shop","shop":"clothes"},46,24,BOUNDARY))
        cleaned = project("node",42,{"name":"Laundry\nService","shop":"laundry","addr:street":"Test\tStreet"},46,24,BOUNDARY)
        self.assertEqual(cleaned["name"],"Laundry Service")
        self.assertEqual(cleaned["address"],"Test Street")

    def test_polygon_holes_are_excluded(self):
        boundary = [[BOUNDARY[0][0], [[44,23],[45,23],[45,24],[44,24],[44,23]]]]
        self.assertTrue(contains(boundary,46,24))
        self.assertFalse(contains(boundary,44.5,23.5))

    def test_real_osm_parser_nodes_ways_relations_dedup_and_country_boundary(self):
        # The real parser must build ways and national boundary relations from referenced nodes.
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp)/"fixture.osm", Path(tmp)/"out.jsonl"
            source.write_text('''<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Baitly test">
 <node id="1" lat="20" lon="38"/><node id="2" lat="20" lon="50"/>
 <node id="3" lat="30" lon="50"/><node id="4" lat="30" lon="38"/>
 <node id="11" lat="24" lon="46"><tag k="name" v="مغسلة"/><tag k="shop" v="laundry"/></node>
 <node id="12" lat="24" lon="46"><tag k="name" v="مغسلة"/><tag k="shop" v="laundry"/><tag k="email" v="public@example.org"/></node>
 <node id="13" lat="25" lon="55"><tag k="name" v="Other country"/><tag k="shop" v="laundry"/></node>
 <node id="21" lat="25" lon="47"/><node id="22" lat="25" lon="47.001"/>
 <node id="23" lat="25.001" lon="47.001"/><node id="24" lat="25.001" lon="47"/>
 <node id="31" lat="26" lon="48"/><node id="32" lat="26" lon="48.001"/>
 <node id="33" lat="26.001" lon="48.001"/><node id="34" lat="26.001" lon="48"/>
 <way id="100"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/></way>
 <way id="200"><nd ref="21"/><nd ref="22"/><nd ref="23"/><nd ref="24"/><nd ref="21"/>
  <tag k="name" v="Workshop"/><tag k="craft" v="electrician"/></way>
 <way id="300"><nd ref="31"/><nd ref="32"/><nd ref="33"/><nd ref="34"/><nd ref="31"/></way>
 <relation id="400"><member type="way" ref="300" role="outer"/>
  <tag k="type" v="multipolygon"/><tag k="name" v="Cleaner"/><tag k="craft" v="cleaning"/></relation>
 <relation id="500"><member type="way" ref="100" role="outer"/>
  <tag k="type" v="boundary"/><tag k="boundary" v="administrative"/><tag k="admin_level" v="2"/><tag k="ISO3166-1" v="SA"/></relation>
</osm>''', encoding="utf-8")
            self.assertEqual(extract(source, output),3)
            rows = [json.loads(line) for line in output.read_text().splitlines()]
            self.assertEqual({r["identifier"] for r in rows}, {"node/11","way/200","relation/400"})
            laundry = next(r for r in rows if r["identifier"]=="node/11")
            self.assertEqual(laundry["email"],"public@example.org")
            self.assertEqual(laundry["osmSources"],["node/11","node/12"])
            self.assertEqual(laundry["mergedFieldSources"]["email"],"node/12")
            self.assertEqual(next(r for r in rows if r["identifier"]=="way/200")["service"],"MAINTENANCE")
            source.write_text('<osm version="0.6"/>')
            with self.assertRaisesRegex(ValueError,"boundary"):
                extract(source,output)


if __name__ == "__main__":
    unittest.main()
