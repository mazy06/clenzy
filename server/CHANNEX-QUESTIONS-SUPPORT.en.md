# Channex — open questions for support and sales

> Version française : [CHANNEX-QUESTIONS-SUPPORT.md](CHANNEX-QUESTIONS-SUPPORT.md).
> Keep both in sync when either changes.

> Compiled 2026-08-07, from an audit of our integration against the public
> documentation at `docs.channex.io`.
>
> **Every question below comes from a point the documentation does not
> settle.** None of them ask for a general explanation: each is a gap that has
> forced — or would force — us to make a technical decision blind. The source of
> the ambiguity is cited each time.
>
> Priorities: **P0** blocks work already in progress · **P1** determines an
> architectural choice · **P2** informational, confirm when convenient.
>
> About us: we are a multi-tenant PMS for short-term rentals, operating in
> France and Morocco, integrated with Channex through a single API key.

---

## 1. Multi-tenant isolation (groups)

Context: we run a multi-tenant PMS on **one Channex API key**. `GET /properties`
therefore returns the entire account — every one of our client organisations at
once. We built isolation on **groups**: one group per organisation, and we
filter discovery by group membership.

| # | Prio | Question |
|---|---|---|
| 1.1 | **P0** | Does the **channel connection iframe** respect group boundaries? When our user opens the wizard on a property in group A, can they see or map properties belonging to group B? *Our API-side isolation is worthless if the iframe exposes the whole account.* |
| 1.2 | **P0** | Is there a **per-group API key**, or a token scoped to a single group? That would be far stronger isolation than our application-level filtering, which is only defensive. |
| 1.3 | P1 | Does a property created with `group_id` **also** join a default account group? We systematically detach from all other groups as a precaution — is that necessary? |
| 1.4 | P1 | Is there a **limit on the number of groups** per account? We create one per client organisation. |
| 1.5 | P2 | Can **Group Users** be used to give one of our clients dashboard access restricted to their own group, without seeing the others? |

## 2. Rate limits

Source of the ambiguity: `api-v.1-documentation/rate-limits` states verbatim
"The limit is 20 ARI total per minute **total** and broken down into 2
endpoints: 10 Restrictions & Price Requests **per minute per property**, 10
Availability Requests **per minute per property**". The word "total" and the
phrase "per property" contradict each other.

| # | Prio | Question |
|---|---|---|
| 2.1 | **P0** | Are the 20 ARI calls per minute **per property** or **per account**? We sized our aggregator on the "per property" reading (2+2 calls/min/property). If the limit is account-wide, our architecture does not hold beyond roughly five active properties. |
| 2.2 | **P0** | If there **is** an account-level ceiling, what is its value, and does it scale with the number of contracted properties? |
| 2.3 | P1 | Do **non-ARI endpoints** (properties, channels, bookings, groups) have any rate limit? None is documented. Our admin screens chain several `GET /groups/:id` and `GET /channels` calls. |
| 2.4 | P1 | Do you return a **`Retry-After`** header on a 429? The documentation mentions none, so we apply a fixed one-minute pause as recommended. |
| 2.5 | P2 | Is there a **maximum number of entries** per `POST /availability` or `POST /restrictions` call? The documentation states none. We chunk at 5000 entries out of caution, not because of a known constraint. |

## 3. Taxes and city tax

Context: we operate in **Morocco and France**, where a municipal city tax is a
legal obligation. Our internal model covers it; we want to know whether Channex
can carry it through to the channels.

| # | Prio | Question |
|---|---|---|
| 3.1 | **P0** | Are `taxes` / `tax_sets` **actually transmitted to the OTAs** (Airbnb, Booking.com, Vrbo, Expedia), or are they used only for display and reporting inside Channex? *Neither the Taxes page nor the Channel API page says.* **Without a positive answer we will not invest in this.** |
| 3.2 | **P0** | If yes: **which channels** actually consume taxes, and in what form (included in the rate, added on top, displayed separately)? |
| 3.3 | **P0** | How do we express an **age-based exemption** ("free for guests under 18")? Airbnb and Booking.com both understand this concept; the Channex tax model does not appear to expose it. *This is our single real blocker: without it, a transmitted tax would be overstated as soon as a stay includes children, and we would rather transmit nothing than transmit a wrong amount.* |
| 3.4 | P1 | How do we express a **per-person-per-night cap** (a ceiling beyond which the tax stops increasing)? Common in French municipal tax schedules. |
| 3.5 | P1 | `applicable_date_ranges` is capped at **20 ranges**. Is that enough for a multi-year seasonal schedule, or must the tax be recreated each year? |
| 3.6 | P2 | Does the `level` field on a tax set govern **cascading taxation** — i.e. a departmental surcharge computed on top of the municipal tax rather than on the bare rate? |

## 4. Content pushed to the channels

| # | Prio | Question |
|---|---|---|
| 4.1 | P1 | **Which channels consume what** — `description`, `photos`, `facilities`, `hotel_policies`? The Channel API page only says "each channel mapping is different". We would like to know which content actually has an effect before building the mappings. |
| 4.2 | P1 | The **facilities catalogue is read-only** (181 entries) and you invite us to contact you for additions. What is the **turnaround** on such a request, and would you accept facilities specific to Moroccan short-term rentals (hammam, riad terrace, patio)? |
| 4.3 | P1 | Are **hotel policies required** by any specific channel (Booking.com content completeness, Google Vacation Rental prerequisites)? `POST /hotel_policies` mandates parking, internet access, pets and smoking — fields a short-term rental PMS does not always hold. Can a partial policy be created? |
| 4.4 | P2 | Is the cancellation policy carried on the **rate plan** and booking settings rather than on the hotel policy? That is our reading of the documentation and we would like it confirmed. |

## 5. Webhooks

| # | Prio | Question |
|---|---|---|
| 5.1 | **P0** | Your webhooks carry **no HMAC signature**. Is a shared secret in a custom header your official recommendation, or is there an undocumented signing mechanism? Is there an **IP range** we should allowlist? *This channel delivers bookings that trigger financial side effects on our side.* |
| 5.2 | P1 | Is cryptographic signing on your roadmap, and on what timeline? |
| 5.3 | P1 | What happens if we **never acknowledge** a booking? `non_acked_booking` fires after 30 minutes — and then? Is there a channel-side consequence (automatic cancellation, host alert)? |
| 5.4 | P2 | What is your **redelivery policy** when our endpoint fails (number of attempts, spacing, give-up threshold)? |

## 6. Channel connection and whitelabel

Context: on a standard account we cannot create a channel through the API, so we
go through your iframe widget. We had to invent a "pivot" property to anchor the
OAuth flow.

| # | Prio | Question |
|---|---|---|
| 6.1 | **P0** | Is the **pivot property** workaround — creating a technical property to carry account-level OTA authentication — the pattern you recommend, or is there an endpoint designed for this? *We would rather not depend on a workaround.* |
| 6.2 | **P0** | What exactly does **whitelabel status** unlock? We have identified: channel creation via API, mapping a listing to a room, per-property webhook registration. Is that list complete? **Commercial terms and pricing?** |
| 6.3 | P1 | Will a standard account ever be able to **create a channel through the API** without moving to whitelabel? |
| 6.4 | P2 | Can the iframe widget be **pre-filled beyond the OTA filter** (credentials, listing selection) to shorten the flow for our hosts? |

## 7. Payment Application API

| # | Prio | Question |
|---|---|---|
| 7.1 | **P0** | Is the **Payment Application API** available on a **standard** account, or is it whitelabel-only? |
| 7.2 | **P0** | Does it work with **Moroccan** Stripe accounts? *Stripe does not operate in Morocco, which makes this decisive for our primary market.* If not, do you plan to support other providers (CMI, PayZone, or a local acquirer)? |
| 7.3 | P1 | What is the **fee model**: a Channex commission per transaction, a subscription, or Stripe fees only? |
| 7.4 | P1 | Does it cover **pre-authorisation / security deposits** (card hold without capture, deferred capture, release)? |
| 7.5 | P2 | How does it relate to the **Stripe tokenisation** already exposed on bookings? Are these competing or complementary paths? |

## 8. Moroccan market

| # | Prio | Question |
|---|---|---|
| 8.1 | **P0** | Which **channels are available** for properties located in Morocco? Airbnb, Booking.com, Expedia, Vrbo — are there country restrictions? |
| 8.2 | P1 | Is **MAD** supported as a property and rate plan currency across all channels? |
| 8.3 | P1 | Are there **Morocco-specific content requirements** (classification, licence, establishment number) imposed by the channels that we should be collecting? |

## 9. Sizing limits

| # | Prio | Question |
|---|---|---|
| 9.1 | P1 | Is there a **limit on the number of properties** per account? The documentation caps room types (50) and rate plans (10 per room type) for vacation rentals, but says nothing about the account. |
| 9.2 | P2 | You state that these caps can be **raised case by case**. What is the process and the turnaround? |

---

## Commercial questions

| # | Question |
|---|---|
| C.1 | **Pricing model**: per property, per connected channel, per booking, or flat fee? Exact schedule for portfolios of 10, 100 and 1000 properties. |
| C.2 | Is a property **with no active channel** (created but not yet distributed) billed? *Our onboarding flow creates them ahead of time; our financial exposure depends on the answer.* |
| C.3 | Does `property_type: "apartment"` correctly select the **Vacation Rental** billing scale rather than the hotel one? |
| C.4 | Do technical **pivot properties**, and the orphaned properties we purge, count towards billing? |
| C.5 | **Test environment**: is the sandbox free and open-ended? Does it reflect real channel behaviour, or only the API? |
| C.6 | What is your **service commitment** (uptime, support response time, escalation path during a production incident)? |
| C.7 | Where is **data hosted**? GDPR: are you a processor under Article 28, is a DPA available, are there transfers outside the EU? |
| C.8 | What **notice** do you give for a breaking API change? Do you version, or modify v1 in place? |

---

## What does not need asking

Verified in the documentation and unambiguous — listed here so as not to waste
your time:

- ARI `date_from`/`date_to` format, required and optional fields.
- The catalogue of 25 webhook event types.
- The "a property must belong to at least one group" constraint, hence the
  attach-then-detach ordering.
- The absence of a `group_id` filter on `GET /properties` (filters: `id`,
  `title`, `is_active`) — hence querying the group rather than the properties.
- The `event_mask` semicolon-separated string format.
