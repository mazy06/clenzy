# Calendar and multi-property planning in Baitly

## How does the multi-property Planning work?

The Planning menu displays the calendar of all your properties in a single view: one row per property, a timeline of dates in columns, and colored bars representing reservations and blocks. Three zoom levels are available: Week, Fortnight and Month. Arrows let you navigate through time, the Today button re-centers the view on the current date (marked by a vertical line), and a full-screen mode maximizes the display area. When your portfolio is large, pagination scrolls through properties in groups, and a filter button narrows down the display. A legend identifies the channels (Airbnb, Booking, Direct), the reservation statuses and the interventions; you can hide or show each channel and each status with a click to keep only what matters to you. Hovering over or clicking a bar shows a tooltip with the reservation's details (guest, dates, status); clicking a property's name opens a preview of the property.

## How do I know whether a property is available on a given date?

On the Planning, an empty slot means the property is available: only booked, blocked or under-maintenance nights carry a bar. Each day in a property's calendar therefore has a state: available, booked, blocked or maintenance. Baitly's calendar engine is the source of truth for availability: it prevents any double booking (anti-overbooking) by refusing the creation of a reservation or block that would overlap an existing event, with an explicit conflict message (conflict with a reservation, a scheduled cleaning, a maintenance or a block). When creating a reservation, the date selection calendar also grays out unavailable nights. Availability is propagated to your connected channels (Airbnb, Booking.com and others) through synchronization, so the platforms reflect the same state as Baitly.

## How do I block a period (renovation work, owner stay)?

From the Planning, select a slot on the relevant property's row and choose the Block mode (the quick creation wizard offers two modes: Reservation or Block). Choose the block type: Blocked (unavailable) for an owner stay or any generic unavailability, or Maintenance / Works for planned renovation. You can add an optional reason (for example "owner stay" or "plumbing work") to keep track. Confirm with Block: the nights concerned become unavailable for booking and appear as a block band on the Planning. The block is checked against the calendar just like a reservation: it is impossible to block dates that are already booked. Blocked periods are also synchronized to your connected channels to close availability everywhere. To free up the dates, simply delete the block from the Planning.

## How do I create or modify a reservation from the Planning?

The Planning is not just a viewing tool: it is also a quick-action tool. Select a free slot on a property's row to open quick creation, with the property and dates pre-filled; all that remains is choosing the guest and the rate. Reservation bars can be manipulated by drag and drop to shift or extend a stay, with a preview of the move before confirmation; the calendar engine refuses any move that would create a conflict. Clicking a reservation opens its preview with access to actions (edit, view the full record). The colors of the bars reflect the original channel (Airbnb, Booking, Direct) and the status (pending, confirmed, checked in, checked out), giving you an immediate read of activity across the whole portfolio.

## Where can I see the intervention planning (cleaning, maintenance)?

In addition to the reservation planning, Baitly offers an "Intervention planning" view: a calendar of all scheduled interventions (cleanings, maintenance, repairs) with their date, type and status. On the reservation Planning, you can also enable the display of interventions via the legend, to visualize cleanings and maintenance alongside stays: handy for checking that a cleaning is indeed scheduled between two reservations. Operational roles (technician, housekeeper, supervisor) find their assignments there; detailed interventions (assignment, before/after photos, progress) are managed in the Interventions menu. A useful reminder: when a check-out occurs and automation is enabled, the cleaning request is created automatically on the departure date.

## How do I import reservations from my other platforms into the calendar?

From the Planning, the Import reservations action offers two methods. iCal import: you paste the calendar link (.ics) provided by the external platform (Airbnb, Booking, Vrbo and others); Baitly then imports the reservations in read-only mode and resynchronizes them regularly. This is the simple, universal method, but it is one-way. The Channel Manager: you connect your distribution platforms for two-way synchronization: reservations, rates and availability flow between Baitly and the channels (which prevents double bookings and distributes your prices). Imported reservations appear on the Planning in the color of their original channel and, just like direct reservations, trigger the automatic cleaning at check-out.

## Frequently asked questions

**Why can't I move a reservation to certain dates?**
The target dates conflict with another reservation, a block, a cleaning or a maintenance. Baitly blocks the operation to prevent any overbooking.

**How do I see only my Airbnb reservations on the Planning?**
Use the channel legend: click the channels you want to hide so only Airbnb remains. The same principle applies to statuses.

**Is a block visible to guests?**
No, a block simply makes the dates unavailable for booking, in Baitly as well as on your synchronized channels.

**What is the difference between the Planning and the Intervention planning?**
The Planning displays stays and blocks per property; the Intervention planning displays cleaning and maintenance assignments in a calendar view. The display of interventions can also be overlaid on the reservation Planning.
