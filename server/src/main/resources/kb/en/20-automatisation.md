# Automation in Baitly

## How do I create an automation rule?

The "Automations" menu centralizes your automation rules. A rule associates a trigger with an action. Two families of triggers exist. Reservation lifecycle triggers, scheduled with an offset in days and a sending time: reservation confirmed, check-in approaching, check-in day, check-out day, after check-out, review reminder. And event triggers, executed immediately: new reservation, reservation cancelled, noise alert, failed payment, critical lock battery, unpaid invoice, pending payout, monthly owner statement, sensor offline, price disparity between channels. Each rule can be restricted by cumulative conditions: targeted properties, minimum or maximum number of nights, guest language. You enable or disable each rule with a click, and an "Enable recommended rules" button installs a starter set of rules in one click. Each rule keeps an execution history (reservation, guest, date, status, any error).

## How do I send automatic messages to guests?

Automatic messages are configured as automation rules with a messaging action: send a message (from a template of your choice), send the welcome guide, send the online check-in link, or request a review after the stay. For each message rule, you choose the sending channel: email or WhatsApp (SMS is not active; a rule configured for SMS falls back to email). A common example: "Check-in approaching, 2 days before at 10 a.m., send the welcome message by email" or "After check-out, request a review". Message templates are managed in the Documents & Communications module (Message templates, WhatsApp templates, Email templates tabs) with variables replaced automatically (guest name, dates, property...). Other automatic actions complete the palette: create a cleaning request at each departure, cancel the linked cleaning when a reservation is cancelled, create a maintenance intervention, notify the team, revoke an access code after departure (with a grace period), follow up on an unpaid invoice, send the monthly statement to the owner, or warn a guest in the event of a noise alert.

## How do automatic rate adjustments (yield) work?

Yield adjusts your prices according to occupancy. It is configured in the pricing section (Yield tab). You create occupancy rules such as "if occupancy is below 40% at 30 days, lower by 5%" or "if occupancy exceeds 85%, raise", with a cap on the adjustment per day. Three execution modes exist: Simulation (a report of what would have changed, no pricing writes), Suggestion (adjustments become proposals to approve, recalculated at the time of application) and Automatic (applied directly). An essential safeguard: each property must have a floor price and a ceiling price; without these two bounds, yield ignores the property. A general switch turns automatic yield on or off, and an adjustment log traces every modification (night concerned, price before/after, observed occupancy, mode). Rate suggestions also appear as cards to validate, with a two-month preview and an impact simulation before application.

## Cards to validate or automatic application: how do I set the autonomy level?

Baitly employs specialized agents (Communication, Revenue, Operations, Finance, Reviews & Reputation) that detect situations and propose actions. By default, they arrive as cards to validate: you accept or dismiss. In the automation settings, you can switch certain safe actions to automatic application, with two levels: "Apply and notify" or "Apply silently". Automatable actions include: scheduling a missing cleaning before a departure, replacing a cleaning provider who has withdrawn, preparing a draft reply to a negative review (publication always remains subject to validation), adjusting rates on slow slots (within the yield framework, limited magnitude), blocking the calendar after a confirmed noise escalation (short range, at most one block per property per week), releasing or refunding a security deposit after departure or cancellation (only with no open issue), and following up on a failed payment (first follow-up only, 72 hours minimum between two follow-ups). Each action displays its 30-day acceptance rate, and Baitly recommends switching to automatic after several consecutive approvals. The agent's level (Suggest / Act then notify / Auto) caps what is possible, and safety envelopes apply (maximum percentage per segment, maximum block duration, delay after departure).

## Which automatic follow-ups does Baitly handle?

Several follow-ups work without manual intervention. Abandoned cart follow-up: a guest who did not complete their reservation on your online booking website can be followed up automatically. Deferred or failed payment follow-up: when a scheduled balance fails, a new payment link is regenerated and sent to the guest (automatically for the first follow-up if you have enabled it, subject to validation afterwards). Unpaid invoice follow-up: an automation rule on the "Unpaid invoice" trigger sends the follow-up or notifies your team. Added to these are automatic promotional campaigns ("Promos & Vouchers"): discount campaigns automatically applicable to nightly rates in the booking engine, according to the conditions you define. The hub's read-only "System automations" tab also summarizes the automations managed elsewhere in the product, with their actual status, for overall visibility.

## Frequently asked questions

**Can a money action be fully automatic?**
Deposit releases and refunds only concern lifting a card pre-authorization (no debit) and require the absence of any open issue. Calendar block and refund suggestions coming from rules always remain proposals to validate by default.

**How do I test a yield rule without touching my prices?**
Use Simulation mode: Baitly produces a report of what would have changed, without any pricing writes. Then move to Suggestion, and to Automatic once you are confident.

**Why is yield ignoring one of my properties?**
The floor and ceiling prices are mandatory for each property: without both bounds, yield skips the property. Fill them in in the per-property safeguards.

**Can I restrict an automatic message to certain properties?**
Yes: each rule accepts conditions — targeted properties, minimum/maximum number of nights of the stay, guest language.

**How do I know what a rule actually did?**
Open the rule and check its execution history (reservation, guest, date, status, any error). For yield, the adjustment log traces every modified price before/after.
