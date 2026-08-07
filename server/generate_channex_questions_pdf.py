#!/usr/bin/env python3
"""Questionnaire Channex — génère le PDF à envoyer au support et au commercial.

Usage :

    python3 server/generate_channex_questions_pdf.py
    python3 server/generate_channex_questions_pdf.py --out ~/Desktop

Rend le HTML puis l'imprime en PDF via Chrome en mode headless. Aucune
dépendance Python : ni reportlab, ni weasyprint. Sortie par défaut dans un
répertoire temporaire — le PDF et le HTML ne sont PAS versionnés, seule cette
source l'est.

⚠ TROISIÈME COPIE DU CONTENU. Les questions vivent aussi dans
CHANNEX-QUESTIONS-SUPPORT.md (référence interne, français) et
CHANNEX-QUESTIONS-SUPPORT.en.md (version envoyée). Toute modification doit être
portée dans les trois, sans quoi le PDF finira par contredire les documents.
Si cette contrainte devient pénible : ce fichier porte déjà TOUT le contenu
anglais, il peut donc devenir la source unique et regénérer le .md anglais —
c'est le refactor à faire, pas une passe de synchronisation manuelle de plus.

Design volontairement distinct du thème PDF Baitly historique (docs/
baitly_pdf_theme.py) : une seule typographie, une seule teinte d'accent, pas
d'aplats de couleur — la hiérarchie passe par le poids, l'échelle et le blanc.
Le document est un formulaire : chaque question offre soit des cases à cocher,
soit des lignes réglées, jamais les deux sans raison.

Pas d'emoji ni de flèches typographiques dans le contenu : le thème historique
les rendait en carrés noirs, et rien ne garantit que la police de secours de
Chrome fasse mieux.
"""
import argparse
import html
import pathlib
import shutil
import subprocess
import sys
import tempfile

# Chrome est le moteur de rendu : c'est lui qui applique le CSS d'impression.
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
]

# ── Identité ────────────────────────────────────────────────────────────────
INK      = "#16232C"   # encre principale, teintée vers le bleu nuit du wordmark
MUTED    = "#5C6C77"
FAINT    = "#8A99A3"
RULE     = "#E1E7EA"
ACCENT   = "#6B8A9A"   # primaire Baitly, celui du mark
BLUE     = "#2563EB"   # packet « request » du mark
TEAL     = "#14B8A6"   # packet « response » du mark
P0       = "#B0544E"

MARK_PATH = (
    "M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 "
    "V710 A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 "
    "313.9 419.6 L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 "
    "719 441.8 V675 A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 "
    "A30.25 30.25 0 0 1 559 529.75 A30.25 30.25 0 0 1 559 590.25"
)


def baitly_mark(size=34):
    """Le mark Baitly : trait continu + deux packets (request bleu, response teal)."""
    common = ('fill="none" stroke-width="21" stroke-linecap="round" '
              'stroke-linejoin="round"')
    return f'''<svg viewBox="251 251 522 522" width="{size}" height="{size}" aria-label="Baitly">
  <path stroke="{ACCENT}" {common} d="{MARK_PATH}"/>
  <path stroke="{BLUE}" {common} pathLength="100" stroke-dasharray="5 95" stroke-dashoffset="-18" d="{MARK_PATH}"/>
  <path stroke="{TEAL}" {common} pathLength="100" stroke-dasharray="5 95" stroke-dashoffset="-63" d="{MARK_PATH}"/>
</svg>'''


YN = ["Yes", "No", "Partly", "N/A"]

# ── Le questionnaire ────────────────────────────────────────────────────────
# (id, priorité, question, options | None)   None => réponse libre uniquement.
SECTIONS = [
    ("1", "Multi-tenant isolation (groups)",
     "We run a multi-tenant PMS on one Channex API key, so <code>GET /properties</code> "
     "returns the whole account. We built isolation on groups — one per client "
     "organisation — and filter discovery by group membership.",
     [
      ("1.1", "P0", "Does the channel connection iframe respect group boundaries? When our user opens the wizard on a property in group A, can they see or map properties in group B? <em>Our API-side isolation is worthless if the iframe exposes the whole account.</em>", YN),
      ("1.2", "P0", "Is there a per-group API key, or a token scoped to a single group? That would be far stronger than our application-level filtering.", YN),
      ("1.3", "P1", "Does a property created with <code>group_id</code> also join a default account group? We detach from all other groups as a precaution — is that necessary?", YN),
      ("1.4", "P1", "Is there a limit on the number of groups per account? We create one per client organisation.", YN),
      ("1.5", "P2", "Can Group Users give one of our clients dashboard access restricted to their own group, without seeing the others?", YN),
     ]),

    ("2", "Rate limits",
     "Your documentation states verbatim: “The limit is 20 ARI total per minute "
     "<strong>total</strong> and broken down into 2 endpoints: 10 Restrictions &amp; Price "
     "Requests <strong>per minute per property</strong>, 10 Availability Requests "
     "<strong>per minute per property</strong>.” The word “total” and the phrase “per "
     "property” contradict each other.",
     [
      ("2.1", "P0", "Are the 20 ARI calls per minute counted per property or per account? We sized our aggregator on “per property” (2+2 calls/min/property). If it is account-wide, our architecture does not hold beyond roughly five active properties.",
       ["Per property", "Per account", "Other"]),
      ("2.2", "P0", "If there is an account-level ceiling, what is its value, and does it scale with the number of contracted properties?", None),
      ("2.3", "P1", "Do non-ARI endpoints (properties, channels, bookings, groups) have any rate limit? None is documented.", YN),
      ("2.4", "P1", "Do you return a <code>Retry-After</code> header on a 429? We currently apply a fixed one-minute pause, as recommended.", YN),
      ("2.5", "P2", "Is there a maximum number of entries per <code>POST /availability</code> or <code>POST /restrictions</code> call? We chunk at 5000 out of caution, not because of a known constraint.", YN),
     ]),

    ("3", "Taxes and city tax",
     "We operate in Morocco and France, where a municipal city tax is a legal "
     "obligation. Our internal model covers it; we want to know whether Channex can "
     "carry it through to the channels.",
     [
      ("3.1", "P0", "Are <code>taxes</code> / <code>tax_sets</code> actually transmitted to the OTAs (Airbnb, Booking.com, Vrbo, Expedia), or used only for display and reporting inside Channex? <em>Without a positive answer we will not invest in this.</em>", YN),
      ("3.2", "P0", "If yes: which channels actually consume taxes, and in what form (included in the rate, added on top, displayed separately)?", None),
      ("3.3", "P0", "How do we express an age-based exemption (“free for guests under 18”)? Airbnb and Booking.com both understand this; the tax model does not appear to expose it. <em>This is our single real blocker — we would rather transmit nothing than a wrong amount.</em>", YN),
      ("3.4", "P1", "How do we express a per-person-per-night cap (a ceiling beyond which the tax stops increasing)? Common in French municipal schedules.", YN),
      ("3.5", "P1", "<code>applicable_date_ranges</code> is capped at 20 ranges. Is that enough for a multi-year seasonal schedule, or must the tax be recreated each year?", YN),
      ("3.6", "P2", "Does <code>level</code> on a tax set govern cascading taxation — a departmental surcharge computed on top of the municipal tax rather than on the bare rate?", YN),
     ]),

    ("4", "Content pushed to the channels", None,
     [
      ("4.1", "P1", "Which channels consume what — <code>description</code>, <code>photos</code>, <code>facilities</code>, <code>hotel_policies</code>? The Channel API page only says “each channel mapping is different”.", None),
      ("4.2", "P1", "The facilities catalogue is read-only (181 entries) and you invite us to contact you for additions. What is the turnaround, and would you accept facilities specific to Moroccan short-term rentals (hammam, riad terrace, patio)?", None),
      ("4.3", "P1", "Are hotel policies required by any specific channel (Booking.com content completeness, Google Vacation Rental)? <code>POST /hotel_policies</code> mandates parking, internet, pets and smoking — fields a short-term rental PMS does not always hold. Can a partial policy be created?", YN),
      ("4.4", "P2", "Is the cancellation policy carried on the rate plan and booking settings rather than on the hotel policy? That is our reading; we would like it confirmed.", YN),
     ]),

    ("5", "Webhooks", None,
     [
      ("5.1", "P0", "Your webhooks carry no HMAC signature. Is a shared secret in a custom header your official recommendation? Is there an IP range we should allowlist? <em>This channel delivers bookings that trigger financial side effects on our side.</em>", YN),
      ("5.2", "P1", "Is cryptographic signing on your roadmap, and on what timeline?", YN),
      ("5.3", "P1", "What happens if we never acknowledge a booking? <code>non_acked_booking</code> fires after 30 minutes — and then? Any channel-side consequence?", None),
      ("5.4", "P2", "What is your redelivery policy when our endpoint fails (attempts, spacing, give-up threshold)?", None),
     ]),

    ("6", "Channel connection and whitelabel",
     "On a standard account we cannot create a channel through the API, so we go "
     "through your iframe widget. We had to invent a “pivot” property to anchor the "
     "OAuth flow.",
     [
      ("6.1", "P0", "Is the pivot property workaround — a technical property carrying account-level OTA authentication — the pattern you recommend, or is there an endpoint designed for this? <em>We would rather not depend on a workaround.</em>",
       ["Recommended pattern", "A dedicated endpoint exists", "Other"]),
      ("6.2", "P0", "What exactly does whitelabel status unlock? We identified: channel creation via API, mapping a listing to a room, per-property webhook registration. Is that list complete? Commercial terms and pricing?", None),
      ("6.3", "P1", "Will a standard account ever be able to create a channel through the API without moving to whitelabel?", YN),
      ("6.4", "P2", "Can the iframe be pre-filled beyond the OTA filter (credentials, listing selection) to shorten the flow for our hosts?", YN),
     ]),

    ("7", "Payment Application API", None,
     [
      ("7.1", "P0", "Is the Payment Application API available on a standard account, or whitelabel-only?",
       ["Standard account", "Whitelabel only", "Other"]),
      ("7.2", "P0", "Does it work with Moroccan Stripe accounts? <em>Stripe does not operate in Morocco, which makes this decisive for our primary market.</em> If not, do you plan to support other providers (CMI, PayZone, a local acquirer)?", YN),
      ("7.3", "P1", "What is the fee model: a Channex commission per transaction, a subscription, or Stripe fees only?", None),
      ("7.4", "P1", "Does it cover pre-authorisation and security deposits (card hold without capture, deferred capture, release)?", YN),
      ("7.5", "P2", "How does it relate to the Stripe tokenisation already exposed on bookings — competing or complementary paths?", None),
     ]),

    ("8", "Moroccan market", None,
     [
      ("8.1", "P0", "Which channels are available for properties located in Morocco? Airbnb, Booking.com, Expedia, Vrbo — are there country restrictions?", None),
      ("8.2", "P1", "Is MAD supported as a property and rate plan currency across all channels?", YN),
      ("8.3", "P1", "Are there Morocco-specific content requirements (classification, licence, establishment number) imposed by the channels that we should be collecting?", YN),
     ]),

    ("9", "Sizing limits", None,
     [
      ("9.1", "P1", "Is there a limit on the number of properties per account? The documentation caps room types (50) and rate plans (10 per room type) for vacation rentals, but says nothing about the account.", YN),
      ("9.2", "P2", "You state these caps can be raised case by case. What is the process and the turnaround?", None),
     ]),

    ("C", "Commercial", None,
     [
      ("C.1", "P0", "Pricing model: per property, per connected channel, per booking, or flat fee? Please give the exact schedule for portfolios of 10, 100 and 1000 properties.", None),
      ("C.2", "P0", "Is a property with no active channel (created but not yet distributed) billed? <em>Our onboarding creates them ahead of time; our exposure depends on the answer.</em>", YN),
      ("C.3", "P1", "Does <code>property_type: \"apartment\"</code> correctly select the Vacation Rental billing scale rather than the hotel one?", YN),
      ("C.4", "P1", "Do technical pivot properties, and orphaned properties we purge, count towards billing?", YN),
      ("C.5", "P1", "Is the sandbox free and open-ended? Does it reflect real channel behaviour, or only the API?", YN),
      ("C.6", "P1", "What is your service commitment — uptime, support response time, escalation path during a production incident?", None),
      ("C.7", "P0", "Where is data hosted? GDPR: are you a processor under Article 28, is a DPA available, are there transfers outside the EU?", None),
      ("C.8", "P1", "What notice do you give for a breaking API change? Do you version, or modify v1 in place?", None),
     ]),
]

SETTLED = [
    "ARI <code>date_from</code>/<code>date_to</code> format, required and optional fields.",
    "The catalogue of 25 webhook event types.",
    "The “a property must belong to at least one group” constraint, hence the attach-then-detach ordering.",
    "The absence of a <code>group_id</code> filter on <code>GET /properties</code> (filters: <code>id</code>, <code>title</code>, <code>is_active</code>).",
    "The <code>event_mask</code> semicolon-separated string format.",
]

CSS = f"""
@page {{ size: A4; margin: 17mm 15mm 15mm; }}

* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; }}
body {{
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: {INK};
  font-size: 9.6pt;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}}
code {{
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9em;
  color: {MUTED};
  background: #F4F7F8;
  padding: 0.5pt 2.5pt;
  border-radius: 2px;
}}
em {{ font-style: normal; color: {MUTED}; }}
strong {{ font-weight: 600; }}

/* ── Couverture ─────────────────────────────────────────────────────── */
.cover {{ page-break-after: always; padding-top: 4mm; }}

.brands {{
  display: flex; align-items: center; gap: 13px;
  padding-bottom: 13mm;
}}
.brand {{ display: flex; align-items: center; gap: 8px; }}
.brand-name {{
  font-size: 15pt; font-weight: 600; letter-spacing: -0.4px; color: {INK};
}}
/* Le lien entre les deux marques reprend le motif du logo : un flux, et un
   paquet qui circule. Pas un simple tiret. */
.link {{ flex: 1; height: 9px; position: relative; }}
.link:before {{
  content: ""; position: absolute; left: 0; right: 0; top: 4px;
  height: 1px; background: {RULE};
}}
.link:after {{
  content: ""; position: absolute; left: 42%; top: 1.5px;
  width: 6px; height: 6px; border-radius: 50%; background: {TEAL};
}}

.eyebrow {{
  font-size: 7.6pt; font-weight: 600; letter-spacing: 1.5px;
  text-transform: uppercase; color: {ACCENT}; margin-bottom: 5mm;
}}
h1 {{
  font-size: 27pt; font-weight: 600; letter-spacing: -1.1px;
  line-height: 1.12; margin: 0 0 5mm; max-width: 15cm; text-wrap: balance;
}}
.lede {{
  font-size: 11pt; line-height: 1.6; color: {MUTED};
  max-width: 14.5cm; margin: 0 0 11mm;
}}
.meta {{
  display: flex; gap: 11mm; padding: 4mm 0 0;
  border-top: 1px solid {RULE}; margin-bottom: 11mm;
}}
.meta div {{ font-size: 8.4pt; }}
.meta dt {{
  color: {FAINT}; font-weight: 600; letter-spacing: 0.6px;
  text-transform: uppercase; font-size: 7pt; margin-bottom: 1.5mm;
}}

.how {{
  border: 1px solid {RULE}; border-radius: 6px;
  padding: 6mm 7mm; margin-bottom: 8mm;
}}
.how h2 {{ font-size: 10.5pt; font-weight: 600; margin: 0 0 3mm; }}
.how p {{ margin: 0 0 3mm; color: {MUTED}; font-size: 9.2pt; }}
.how p:last-child {{ margin-bottom: 0; }}

.legend {{ display: flex; gap: 9mm; }}
.legend div {{ font-size: 8.4pt; color: {MUTED}; }}

/* ── Sections ───────────────────────────────────────────────────────── */
.section {{ margin-top: 9mm; }}
.section:first-of-type {{ margin-top: 0; }}
.sec-head {{
  display: flex; align-items: baseline; gap: 4mm;
  padding-bottom: 2.5mm; border-bottom: 1.5px solid {INK};
  margin-bottom: 4mm; page-break-after: avoid;
}}
.sec-num {{
  font-size: 8pt; font-weight: 600; color: {ACCENT};
  letter-spacing: 1px;
}}
.sec-title {{ font-size: 13pt; font-weight: 600; letter-spacing: -0.3px; }}
.sec-note {{
  font-size: 8.8pt; color: {MUTED}; line-height: 1.55;
  margin-bottom: 4.5mm; max-width: 16cm; page-break-after: avoid;
}}

/* ── Question ───────────────────────────────────────────────────────── */
.q {{
  display: flex; gap: 4.5mm;
  padding: 3.6mm 0 6.5mm;
  page-break-inside: avoid;
}}
.q-gutter {{ width: 15mm; flex-shrink: 0; padding-top: 0.4mm; }}
.q-id {{ font-size: 9pt; font-weight: 600; color: {INK}; }}
.q-prio {{
  display: block; font-size: 7pt; font-weight: 700;
  letter-spacing: 0.9px; margin-top: 0.7mm;
}}
.p0 {{ color: {P0}; }}
.p1 {{ color: {ACCENT}; }}
.p2 {{ color: {FAINT}; }}
.q-body {{ flex: 1; min-width: 0; }}
.q-text {{ margin-bottom: 2.6mm; }}

.opts {{ display: flex; gap: 5.4mm; margin-bottom: 2.2mm; }}
.opt {{ display: flex; align-items: center; gap: 2mm; font-size: 8.8pt; }}
.cb {{
  width: 3.1mm; height: 3.1mm; border: 1px solid {ACCENT};
  border-radius: 1px; flex-shrink: 0;
}}
.rules .rule {{
  border-bottom: 1px solid {RULE}; height: 5.2mm;
}}
.detail {{
  font-size: 7.4pt; color: {FAINT}; letter-spacing: 0.5px;
  text-transform: uppercase; font-weight: 600; margin-bottom: 1.2mm;
}}

/* ── Clôture ────────────────────────────────────────────────────────── */
.settled {{ margin-top: 9mm; page-break-inside: avoid; }}
.settled ul {{ margin: 0; padding-left: 4.5mm; color: {MUTED}; font-size: 8.8pt; }}
.settled li {{ margin-bottom: 1.6mm; }}
.signoff {{
  margin-top: 9mm; padding-top: 4mm; border-top: 1px solid {RULE};
  display: flex; gap: 10mm; page-break-inside: avoid;
}}
.signoff div {{ flex: 1; }}
.signoff .lbl {{
  font-size: 7pt; font-weight: 600; letter-spacing: 0.7px;
  text-transform: uppercase; color: {FAINT}; margin-bottom: 6mm;
}}
.signoff .line {{ border-bottom: 1px solid {RULE}; }}
"""


def render_question(qid, prio, text, opts):
    if opts:
        boxes = "".join(
            f'<span class="opt"><span class="cb"></span>{html.escape(o)}</span>'
            for o in opts
        )
        answer = (f'<div class="opts">{boxes}</div>'
                  f'<div class="detail">Details</div>'
                  f'<div class="rules"><div class="rule"></div><div class="rule"></div></div>')
    else:
        answer = ('<div class="detail">Answer</div>'
                  '<div class="rules">'
                  '<div class="rule"></div><div class="rule"></div><div class="rule"></div>'
                  '</div>')
    return f'''<div class="q">
  <div class="q-gutter">
    <div class="q-id">{qid}</div>
    <span class="q-prio {prio.lower()}">{prio}</span>
  </div>
  <div class="q-body">
    <div class="q-text">{text}</div>
    {answer}
  </div>
</div>'''


def build():
    body = [f'''<div class="cover">
  <div class="brands">
    <div class="brand">{baitly_mark(34)}<span class="brand-name">Baitly</span></div>
    <div class="link"></div>
    <div class="brand"><span class="brand-name" style="color:{MUTED};letter-spacing:-0.2px">channex</span></div>
  </div>

  <div class="eyebrow">Integration review</div>
  <h1>Open questions on the Channex API</h1>
  <p class="lede">We audited our integration against your public documentation and
  found a number of points it does not settle. Each question below blocks — or has
  already forced — a technical decision on our side. None of them ask for a general
  explanation.</p>

  <div class="meta">
    <div><dt>From</dt>Baitly — multi-tenant PMS for short-term rentals, France and Morocco</div>
    <div><dt>Date</dt>7 August 2026</div>
    <div><dt>Questions</dt>46 across 10 sections</div>
  </div>

  <div class="how">
    <h2>How to answer</h2>
    <p>Tick a box where one fits, and use the ruled lines whenever the answer
    deserves more than a box — most of them do. Feel free to skip anything outside
    your remit and pass it on; we would rather have a partial answer from the right
    person than a complete one from the wrong one.</p>
    <p>Questions marked <strong style="color:{P0}">P0</strong> block work already in
    progress. If your time is limited, those are the ones worth your attention.</p>
    <div class="legend">
      <div><strong class="p0">P0</strong> &nbsp;Blocks work in progress</div>
      <div><strong class="p1">P1</strong> &nbsp;Determines an architectural choice</div>
      <div><strong class="p2">P2</strong> &nbsp;Informational</div>
    </div>
  </div>
</div>''']

    for num, title, note, questions in SECTIONS:
        s = ['<div class="section">',
             f'<div class="sec-head"><span class="sec-num">{num}</span>'
             f'<span class="sec-title">{title}</span></div>']
        if note:
            s.append(f'<div class="sec-note">{note}</div>')
        s += [render_question(*q) for q in questions]
        s.append('</div>')
        body.append("".join(s))

    body.append('<div class="settled">'
                '<div class="sec-head"><span class="sec-num">—</span>'
                '<span class="sec-title">What does not need answering</span></div>'
                '<div class="sec-note">Verified in your documentation and unambiguous. '
                'Listed so as not to waste your time.</div><ul>'
                + "".join(f'<li>{s}</li>' for s in SETTLED) + '</ul></div>')

    body.append('<div class="signoff">'
                '<div><div class="lbl">Answered by</div><div class="line"></div></div>'
                '<div><div class="lbl">Role</div><div class="line"></div></div>'
                '<div><div class="lbl">Date</div><div class="line"></div></div>'
                '</div>')

    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<title>Baitly - Channex integration questions</title>'
            f'<style>{CSS}</style></head><body>{"".join(body)}</body></html>')


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        resolved = candidate if pathlib.Path(candidate).exists() else shutil.which(candidate)
        if resolved:
            return resolved
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default=None,
                        help="répertoire de sortie (défaut : répertoire temporaire)")
    parser.add_argument("--name", default="Baitly-Channex-questions",
                        help="nom de fichier sans extension")
    args = parser.parse_args()

    out_dir = pathlib.Path(args.out).expanduser() if args.out else pathlib.Path(tempfile.mkdtemp())
    out_dir.mkdir(parents=True, exist_ok=True)

    html_path = out_dir / f"{args.name}.html"
    pdf_path = out_dir / f"{args.name}.pdf"
    html_path.write_text(build(), encoding="utf-8")

    total = sum(len(q) for _, _, _, q in SECTIONS)
    print(f"HTML : {html_path}  ({total} questions, {len(SECTIONS)} sections)")

    chrome = find_chrome()
    if not chrome:
        print("Chrome introuvable — le HTML est prêt, imprimez-le en PDF à la main.",
              file=sys.stderr)
        return 1

    subprocess.run(
        [chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf_path}", str(html_path)],
        check=True, capture_output=True,
    )
    if not pdf_path.exists():
        print("Chrome n'a produit aucun PDF.", file=sys.stderr)
        return 1
    print(f"PDF  : {pdf_path}  ({pdf_path.stat().st_size // 1024} Ko)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
