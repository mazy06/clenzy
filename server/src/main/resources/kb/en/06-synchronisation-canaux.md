# Channel synchronization (Airbnb, Booking, Vrbo, iCal, Channel Manager)

## What is channel synchronization in Baitly?

Baitly centralizes your listings published on booking platforms (also called channels or OTAs: Airbnb, Booking.com, Vrbo, Expedia...) and automatically synchronizes calendars, reservations, rates and availability. A reservation taken on one channel blocks the dates everywhere; a price change in Baitly can be pushed to the connected platforms. Management takes place on the Channels page (Distribution section of the menu), titled "Channels & Integrations", which lists your connections with a search and a segment filter. There are three ways to connect a channel: the official Airbnb connection, the Channel Manager (two-way multi-platform synchronization) and iCal import (read-only, universal).

## How do I connect my Airbnb listing?

Baitly offers an Airbnb connection through the official API. From the Channels page, choose Airbnb and start the connection: you are redirected to Airbnb to authorize Baitly on your account. Once connected, the screen shows the connection date, the last synchronization and your Airbnb listings. You then link each Airbnb listing to a Baitly property (or create a new property from the listing). For each linked listing, you can enable synchronization, automatic cleaning creation after each stay and automatic rate push (push pricing), or open the listing directly on Airbnb. Disconnection is possible at any time from the same screen.

## How do I distribute my properties on Booking, Vrbo and other platforms?

Baitly's Channel Manager ("Distribute your properties") lets you put your listings on Airbnb, Booking, Vrbo and other platforms with two-way synchronization: reservations, rates and availability. The guided wizard offers three paths: import your existing listings from Airbnb, Booking or Vrbo (the property's information is pre-filled), connect a property already present in Baitly and published on the platforms, or manage and disconnect your already linked OTAs. A "Technical connection status" panel lets you verify that everything is working. This mode is recommended as soon as you want full synchronization (prices and restrictions included), whereas iCal only synchronizes the calendar.

## How do I import an iCal calendar (Booking.com, Vrbo, Abritel...)?

If a platform is not connected via API, use iCal import: from the Planning, open "Import reservations" then "iCal import", and paste the .ics link provided by the platform (Airbnb, Booking, Vrbo...). The external calendar's reservations are then imported in read-only mode and resynchronized automatically several times a day, with no action on your part. Stays already imported are recognized and are not duplicated. You receive a notification when an import succeeds, is partial or fails, which lets you quickly spot an expired or invalid link. A limitation to be aware of: iCal only carries dates; rates, the guest's full contact details and restrictions do not travel through this channel.

## How does Baitly prevent double bookings?

The Baitly calendar is the source of truth for availability. Each reservation (direct, imported from a channel or entered manually) locks the property's dates atomically: two simultaneous requests on the same slot cannot both go through. As soon as a reservation is confirmed, the dates are pushed as unavailable to the connected channels (Airbnb, Booking, Expedia...). When a reservation is created manually, Baitly also detects conflicts with an existing reservation, a cleaning, a maintenance or a date block, and refuses the creation in case of a blocking overlap. To reduce the residual risk with iCal calendars (whose updates are not instantaneous on the platform side), prefer the Channel Manager for your main channels.

## What should I do in case of a calendar conflict?

If two stays overlap (for example a direct reservation and a reservation imported from a channel), start by checking which one is legitimate, then cancel or move the other: cancellation automatically frees the dates and resynchronizes the channels. A "Conflict detected" message specifies the event involved (a guest's reservation, a cleaning, a maintenance or a block) with its dates. Platform administrators additionally have a Sync & Diagnostics page that audits calendar commands and detects multi-channel conflicts, as well as the state of synchronization tasks. If a conflict keeps recurring on the same property, check that the channel's iCal link is still valid and that synchronization is properly enabled on the listing.

## Frequently asked questions

**Does a reservation taken on my direct website block Airbnb?**
Yes. As soon as payment is confirmed, the dates are marked unavailable and automatically pushed to the connected channels.

**How often are iCal calendars synchronized?**
Automatically, several times a day. You are notified if an import fails or is only partial.

**Can I push my Baitly rates to Airbnb?**
Yes, with the official Airbnb connection: enable automatic rate push on the linked listing, or use the manual push button.

**Does iCal import synchronize prices?**
No, iCal only carries reservation dates. To synchronize rates and availability in both directions, use the Channel Manager.

**Can I reply to guest reviews from Baitly?**
Yes, the Channels section includes a per-platform review screen with the average rating and the ability to reply.
