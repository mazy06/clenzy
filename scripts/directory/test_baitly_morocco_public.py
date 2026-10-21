import copy
import unittest
from build_baitly_saudi_osm_snapshot import project as osm_project
from build_baitly_saudi_public_snapshot import project, merge, phone
from test_baitly_saudi_public import feature, osm


class MoroccoPublicTest(unittest.TestCase):
    def feature(self):
        f=feature()
        f['geometry']['coordinates']=[-7.99,31.63]
        f['properties']['addresses']=[{'country':'MA','locality':'Marrakech','freeform':'10 Rue','postcode':'40000'}]
        f['properties']['phones']=['0524123456']
        return f

    def test_moroccan_contact_and_country_validation(self):
        row=project(self.feature(),lambda x,y:True,'2026-09-23.1','MA')
        self.assertEqual(row['phone'],'+212524123456')
        for value in ('+212 6 12 34 56 78','00212612345678','0612345678'):
            self.assertEqual(phone(value,'MA'),'+212612345678')
        self.assertEqual(phone('+966511111111','MA'),'')
        self.assertIsNone(project(feature(),lambda x,y:True,'test','MA'))
        self.assertIsNone(project(self.feature(),lambda x,y:False,'test','MA'))

    def test_osm_french_name_and_foreign_country_rejection(self):
        tags={'name:fr':'Blanchisserie','shop':'laundry','addr:country':'MA'}
        row=osm_project('node',42,tags,-7.99,31.63,lambda x,y:True,'MA')
        self.assertEqual(row['name'],'Blanchisserie')
        tags['addr:country']='DZ'
        self.assertIsNone(osm_project('node',42,tags,-7.99,31.63,lambda x,y:True,'MA'))

    def test_exact_match_enriches_but_ambiguous_records_remain_unpublished(self):
        original=osm();original.update(address='10 Rue',city='Marrakech',latitude=31.63,longitude=-7.99)
        row=project(self.feature(),lambda x,y:True,'test','MA')
        rows,review=merge([original],[copy.deepcopy(row)],'MA')
        self.assertEqual(len(rows),1);self.assertEqual(review,[])
        self.assertEqual(rows[0]['phone'],'+212524123456')
        self.assertEqual(len(rows[0]['sourceEvidence']),2)
        branch=dict(original,identifier='node/43')
        rows,review=merge([original,branch],[row],'MA')
        self.assertEqual(len(rows),2);self.assertEqual(len(review),1)

    def test_unrelated_trades_low_confidence_and_unknown_licences_rejected(self):
        for key,value in [('taxonomy',{'primary':'automotive_repair'}),('confidence',0.1),('sources',[{'license':'unknown'}]),('operating_status','permanently_closed')]:
            f=self.feature();f['properties'][key]=value
            self.assertIsNone(project(f,lambda x,y:True,'test','MA'))
