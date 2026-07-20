# Reservations in Baitly

## How do I create a manual reservation?

Open the Reservations menu and click New reservation (you can also create one directly from the Planning by selecting a slot). The creation wizard takes four steps: Property & dates (choice of property and stay dates on a two-month calendar), Guest (search for an existing guest or creation of a new guest record with first name, last name, email, phone, nationality, language and notes), Rate & services (base nightly price, custom price, discount in euros or as a percentage, checkout cleaning with cleaning fees, tourist tax per person per night, number of guests including minor children exempt from tourist tax), then Finalization with a summary (property, dates, guest, total). Two validation modes exist: Confirm now, which blocks the calendar immediately, generates access codes and notifies the guest; or Request payment, which creates the reservation as pending and sends a payment link to the guest, with the dates only blocked once payment is received.

## What do reservation statuses mean?

A reservation goes through several statuses over its lifecycle. Pending: the reservation has been created but not yet confirmed, for example while awaiting payment; the dates are not yet locked. Confirmed: the reservation is validated and the calendar is blocked on those dates. Checked in: the guest has arrived and the stay is in progress. Checked out: the guest has left and the stay is over; it is this departure that can automatically trigger the cleaning request. Cancelled: the reservation has been cancelled and the dates become available again. The status is visible on the reservation list, on the reservation's detail page and on the Planning bars, with a distinct color code per status. You can filter the reservation list by status, property, source and period.

## How do I handle check-in and check-out?

Each reservation carries an arrival date and a departure date, as well as check-in and check-out times. By default, these times inherit the schedule defined on the property's detail page, but they can be adjusted reservation by reservation. When the guest arrives, the reservation moves to the Checked in status; upon departure, to Checked out. The departure is a key operational moment: if automation is enabled in your organization, a cleaning request is created automatically on the check-out date, at the property's default departure time, then assigned to a team (by direct assignment or by geographic area). When a reservation is confirmed, access codes can be generated and sent to the guest for properties equipped with smart locks.

## How do I cancel a reservation or handle a no-show?

From the reservation list or a reservation's detail page, use the Cancel reservation action; a confirmation is requested before cancelling. Once cancelled, the reservation moves to the Cancelled status and the nights concerned become available for sale again on the calendar. If the guest needs to be refunded (a direct reservation already paid), this is handled from the reservation's payments section, according to your cancellation policy. In the event of a no-show (the guest does not turn up), there is no dedicated status: depending on your practice, either leave the reservation as is (the nights remain billed) or cancel it to free up the remaining dates. For reservations coming from an external platform (Airbnb, Booking.com), the cancellation must be processed on the original channel; synchronization then reflects the freed dates in Baitly.

## What is the difference between a direct reservation and an OTA reservation?

Each reservation has a source, visible in the list and filters: Airbnb, Booking.com, Direct or Other. A direct reservation is created in Baitly (manually or through your online booking engine): you control the payment, which can go through a payment link sent to the guest. An OTA reservation comes from an external platform, imported via iCal synchronization (read-only) or via a channel manager (two-way synchronization of reservations, rates and availability). OTA reservations are considered already collected on the original channel: Baitly displays them as paid and does not ask the guest for payment again. All sources come together in the same place: reservation list, planning and statistics, with a color code per channel on the Planning.

## What are the guest record and the police record?

Each reservation is linked to a guest record: last name, first name, email, phone, nationality, language and notes. The guest directory is accessible in the Directory menu, Guests tab, with search by name, email or phone. When creating a reservation, search for an existing guest (at least two characters) or create a new record on the fly. The guest record also feeds the police record where local regulations require it: the reservation displays the main guest and their travel companions, with a Submitted or To be submitted state for the official reporting service, and a Resubmit action in case of transmission failure.

## Frequently asked questions

**Can I create a reservation without the guest's email?**
Yes, for an immediate confirmation. However, an email is required if you choose Request payment, because the payment link is sent to that address.

**Why can't my reservation be created on certain dates?**
A conflict has been detected: the dates overlap another reservation, a cleaning, a maintenance or a block. Baitly prevents the creation to avoid any overbooking.

**Does a pending reservation block the calendar?**
No. Dates are only locked at confirmation, that is, immediately with Confirm now, or upon receipt of payment with Request payment.

**How do I find a specific reservation?**
Use the search and filters on the Reservations page: by property, status, source (Airbnb, Booking.com, Direct, Other) and period.
