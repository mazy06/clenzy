import copy
import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import patch,MagicMock
from enrich_baitly_morocco_websites import enrich,policy_hash,checked_url,Fetcher

NOW=datetime(2026,10,21,12,tzinfo=timezone.utc)
URL='https://pressing.example.org/'
HTML='''<h1>Pressing Test à Agadir</h1><p>Haut Founty</p>
<p>Nous proposons le lavage du linge de maison</p>
<a href="mailto:contact@pressing.example.org">Contact</a>
<a href="tel:0524123456">Appeler</a>
<input value="private@example.org"><script>admin@example.org</script>'''


def policy():
    return {'id':'pressing-test','revision':'2026-10-21.1','decision':'REVIEWED_PUBLIC_BUSINESS_FACTS',
            'reviewedAt':(NOW-timedelta(days=1)).isoformat(),'expiresAt':(NOW+timedelta(days=30)).isoformat(),
            'identities':['MA:OSM:node/42'],'hosts':['pressing.example.org'],'names':['Pressing Test'],
            'locationTokens':['Agadir','Haut Founty'],'emailDomains':['pressing.example.org'],
            'pages':[URL],'conditions':[{'url':URL,'sha256':policy_hash(HTML)}],
            'services':[{'service':'LAUNDRY','label':'Linge de maison','affirmation':'Nous proposons le lavage du linge de maison'}]}


def row():
    return {'identifierType':'OSM','identifier':'node/42','website':URL,'name':'Pressing Test','phone':'','email':'',
            'sourceEvidence':[{'source':'OSM'}]}


class FakeFetch:
    def __init__(self,html=HTML,robots='',status=404):
        self.html,self.robots,self.status=html,robots,status
        self.calls=[]
    def get(self,url,hosts,delay=1,allowed=lambda url:True):
        self.calls.append(url)
        if not allowed(url):raise ValueError('ROBOTS_DISALLOWED')
        return (self.status,self.robots,url) if url.endswith('robots.txt') else (200,self.html,url)


class MoroccoWebsiteTest(unittest.TestCase):
    def test_fills_only_missing_fields_and_records_field_and_service_provenance(self):
        original=row();original['phone']='+212611111111'
        rows,reviews,report=enrich([original],[policy()],FakeFetch(),NOW)
        self.assertEqual(rows[0]['email'],'contact@pressing.example.org')
        self.assertEqual(rows[0]['phone'],original['phone'])
        self.assertEqual(original['email'],'')
        proof=rows[0]['sourceEvidence'][-1]
        self.assertEqual(proof['fields']['email']['url'],URL)
        self.assertEqual(proof['offerings'][0]['label'],'Linge de maison')
        self.assertEqual(rows[0]['websiteServices'],['LAUNDRY'])
        self.assertEqual(report[0]['status'],'VERIFIED')
        self.assertEqual(reviews[0]['reason'],'AMBIGUOUS_OR_CONFLICTING_CONTACT')

    def test_changed_conditions_expired_review_or_robots_failure_never_alter_contacts(self):
        cases=[(policy(),FakeFetch(HTML+'<p>New conditions</p>')),
               (dict(policy(),expiresAt=(NOW-timedelta(days=1)).isoformat()),FakeFetch()),
               (policy(),FakeFetch(robots='User-agent: *\nDisallow: /',status=200)),
               (policy(),FakeFetch(status=403))]
        for p,fetch in cases:
            original=row();rows,_,report=enrich([original],[p],fetch,NOW)
            self.assertEqual(rows,[original]);self.assertEqual(report[0]['status'],'SKIPPED')

    def test_name_city_and_domain_must_match_and_ambiguous_identity_is_not_imported(self):
        p=policy();p['names']=['Other company']
        original=row();rows,_,report=enrich([original],[p],FakeFetch(),NOW)
        self.assertEqual(rows,[original]);self.assertEqual(report[0]['reason'],'WEBSITE_IDENTITY_REQUIRES_REVIEW')
        original['website']='https://other.example.org/'
        fetch=FakeFetch();rows,_,report=enrich([original],[policy()],fetch,NOW)
        self.assertEqual(fetch.calls,[]);self.assertEqual(rows,[original])
        original=row();rows,_,report=enrich([original,copy.deepcopy(original)],[policy()],fetch,NOW)
        self.assertEqual(len(rows),2);self.assertEqual(fetch.calls,[])

    def test_no_private_inputs_or_unverified_email_domains_and_multiple_contacts_need_review(self):
        html=HTML+'<a href="mailto:agency@other.example.org">Agence</a><a href="mailto:branch@pressing.example.org">Agence 2</a>'
        p=policy();p['conditions'][0]['sha256']=policy_hash(html)
        rows,reviews,_=enrich([row()],[p],FakeFetch(html),NOW)
        self.assertEqual(rows[0]['email'],'')
        self.assertEqual(rows[0]['phone'],'+212524123456')
        self.assertEqual({r['reason'] for r in reviews},{'UNVERIFIED_EMAIL_DOMAIN','AMBIGUOUS_OR_CONFLICTING_CONTACT'})

    def test_network_rejects_ssrf_unapproved_hosts_credentials_and_dns_rebinding_targets(self):
        for url in ('http://pressing.example.org/','https://127.0.0.1/','https://evil.example.org/',
                    'https://x:y@pressing.example.org/','https://pressing.example.org:444/',
                    'https://pressing.example.org/%0d%0aInjected'):
            with self.assertRaises(ValueError):checked_url(url,{'pressing.example.org'})
        with patch('socket.getaddrinfo',return_value=[(0,0,0,'',('127.0.0.1',443))]):
            with self.assertRaisesRegex(ValueError,'NON_PUBLIC_ADDRESS'):Fetcher().get(URL,{'pressing.example.org'})

    def test_replay_on_fresh_base_is_deterministic_and_creates_no_companies(self):
        a=enrich([row()],[policy()],FakeFetch(),NOW)
        b=enrich([row()],[policy()],FakeFetch(),NOW)
        self.assertEqual(a,b);self.assertEqual(len(a[0]),1)

    def test_redirect_is_rechecked_before_a_second_connection(self):
        for target,allowed in [('https://127.0.0.1/',lambda url:True),
                               (URL+'private',lambda url:not url.endswith('private'))]:
            response=MagicMock();response.status=302
            response.getheader.return_value=target
            connection=MagicMock();connection.getresponse.return_value=response
            with patch('socket.getaddrinfo',return_value=[(0,0,0,'',('8.8.8.8',443))]), \
                    patch('enrich_baitly_morocco_websites.PinnedHttps',return_value=connection) as client:
                with self.assertRaises(ValueError):Fetcher().get(URL,{'pressing.example.org'},allowed=allowed)
                self.assertEqual(client.call_count,1)


if __name__=='__main__':unittest.main()
