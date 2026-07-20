# Interventions: cleaning, maintenance and check-in/check-out

## How do interventions work in Baitly?

In Baitly, an intervention (also called a mission or task) is a service performed in a property: cleaning, maintenance, repair, gardening, disinfection, etc. The Interventions page in the menu groups three tabs: Service Requests, Interventions and Issues. The normal flow is as follows: a service request is created (manually or automatically after a guest departure), it is validated and then paid if necessary, and it then becomes an intervention carried out by a technician, a housekeeper or a team. The roles involved: the host (owner) creates requests and tracks the missions on their properties; platform managers (super admin, super manager) validate, schedule and assign; field workers execute and document the mission from the mobile app.

## What are the statuses of an intervention?

An intervention goes through precise statuses: Pending (created by a manager, to be processed), Awaiting validation (created by a host, a manager must validate it), Awaiting payment (validated, the host must pay before execution), In progress, Completed (with possible reopening) and Cancelled (final state). Who creates what: a host creates a request that goes to awaiting validation, with no cost set (the manager will define it); a super admin or super manager creates an intervention directly and can set the cost. Field roles (technician, housekeeper, supervisor) do not create interventions: they execute the ones assigned to them.

## How do I schedule automatic cleaning after each departure?

Baitly can automatically create a cleaning request at each guest departure. When a reservation is imported from a channel (Airbnb, Booking via a synchronized calendar), and if the automatic intervention creation option is enabled for your organization, a cleaning request is generated on the check-out date, at the property's default cleaning time (in its timezone). The request displays the departure and the next arrival so the mission can be slotted between two stays; once validated and paid where applicable, the cleaning intervention is created and assigned. Three cleaning types exist: express (mid-stay, lighter), standard (between two stays, known as turnover) and deep clean. Roles involved: the automation setting is managed by managers; the host sees the requests generated on their properties.

## How is the intervention assigned (automatically or manually)?

An intervention is assigned either to a specific user (technician, housekeeper, supervisor) or to an entire team — the two modes are mutually exclusive. When assigned to a team, all its members are notified. Only platform managers (super admin, super manager) can assign. Automatic assignment, which can be enabled or disabled per organization, works as follows: Baitly first looks for the team assigned to the property; failing that, it looks for a team by geographic coverage area, service type and availability. Unassigned requests are automatically retried every 15 minutes. Optionally (disabled by default), Baitly can also promote the best member of the selected team, combining quality score, the rate closest to the recommended scale and the day's workload. A worker already assigned is never replaced automatically.

## How is a cleaning price calculated (cleaning engine)?

Baitly's cleaning engine calculates a recommended price based on a simple idea: a cleaning is working time. It estimates the minutes needed based on the property (a base according to the number of bedrooms, supplements for bathrooms, surface area, floors, outdoor space, linen, extra guests), multiplies them by an hourly rate and by the cleaning type (express cheaper, deep clean more expensive), rounds, applies a floor, and presents a range around a highlighted median. The minute-by-minute breakdown is visible (for example: 2 bedrooms = 120 min, extra floor = 15 min). The manager configures the whole grid (minutes, rates, multipliers, seasonal surcharges) in Pricing, Cleaning tab, with a per-property simulator. The price retained for a mission follows a priority rule: the provider's rate if one exists, otherwise the property's cleaning price if filled in, otherwise the recommended median. The recommended scale at that moment is always recorded alongside the price charged, for comparison (marked "in line with the scale" if the gap is small).

## How is the provider paid for a cleaning?

The payout to the provider (housekeeper or technician) is triggered at the end of the mission, under conditions: the cleaning must have been paid by the host, the quality proof must be present (at least one "after" photo taken on the mission), and the provider must have configured their payout account. Configuration is done in Settings, "My payouts" screen: a bank identification flow is integrated directly into the page. If a condition is missing, the payout is blocked with the reason displayed (missing proof, account not configured) and the provider is notified; a manager can retry after correction — nothing fails silently. An optional platform commission may apply (disabled by default: the provider receives 100% of their pay). Each participant sees their own amount: the provider sees their pay, the host and managers see the billed price. A payout history (mission, amount, status) is available to the provider.

## How do I report and track an issue found during a cleaning?

During a mission, a housekeeper or technician can report an issue from the mobile app (category, severity, description, photos): observed damage, missing item, hygiene problem, faulty equipment, safety risk or other. A manager can also create an issue from the web ("Report an issue" button). Each report becomes a ticket visible in the Issues tab of the Interventions page, with a cost suggested automatically if the category matches the organization's maintenance price catalog. The manager can then Qualify (adjust category, severity, cost), Convert into a pre-priced maintenance request (which follows the normal validation, payment, then intervention flow) or Reject with a reason. Statuses: Open, Qualified, Converted, Rejected. Administrators and the property's owner are notified at reporting and at conversion.

## How do I document a mission in the field (photos, checklist, signature)?

From the mobile app, the field worker documents their mission: "before" and "after" photos of the service, issue photos if a problem is found, a room-by-room cleaning checklist with a timer, report notes and an end-of-mission signature. The "after" photos serve as quality proof: they condition the provider's payout. On the web side, an intervention's detail page displays progress, costs (estimated and actual), notes and instructions (special instructions, access notes, cleaning instructions) and the guests' departure and arrival dates. Roles: technician and housekeeper document, supervisor and managers validate and control, the host views the missions on their properties.

## Frequently asked questions

**Why is my intervention request "Awaiting validation"?**
Because it was created by a host: a manager must validate it (and set the cost) before it moves on to payment and then execution.

**Can I change the cleaning price recommended by Baitly?**
Yes. The recommendation is never binding: the host can adopt the recommended price or enter their own price on the property's detail page, and the provider can have their own rates. The scale remains displayed for comparison.

**Why is my housekeeper's payout blocked?**
Two possible reasons, always displayed: the "after" photo proving the mission is missing, or the provider's payout account is not configured (Settings, "My payouts"). Once corrected, a manager can retry the payout.

**Who can assign an intervention to a team?**
Only platform managers (super admin, super manager). Field roles only see the missions assigned to them, individually or through their team.
