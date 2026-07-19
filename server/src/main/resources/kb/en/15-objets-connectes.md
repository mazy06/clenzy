# Connected objects: noise sensors, smart locks, cameras

## Where do I manage my properties' connected objects?

Connected objects are managed on the Properties page, Connected Objects tab. This hub gathers all your properties' devices by category: Locks, Noise sensors, Key handover, Cameras and Thermostats. You can see the state of your fleet at a glance (offline devices, low battery, ongoing alerts), filter by device type, open the view for a specific property or the detail of a device (real-time data, configuration, history). Adding a device goes through an "Add an object" wizard: choose the property, optionally the room, name the device and confirm. Roles involved: the host views and monitors the devices of their properties; connecting the provider services is managed at platform level (see the dedicated section).

## Who can connect the services (Minut, Nuki, KeyNest...) and what does the host see?

Connections to connected-object providers — Minut (noise and temperature sensors), Nuki (smart locks), KeyNest (key handover network), Tuya (sensors) — are configured in the Integrations tab of Settings, restricted to platform managers (super admin, super manager). The host therefore does not need to create technical accounts: once the service is linked by the platform, they see their devices, their data and their alerts directly in the Connected Objects tab of their properties. Exception: Netatmo sensors follow a per-host model — each host connects their own Netatmo account from the Connected Objects hub, provided the administrator has first enabled the service in Integrations. If a service does not appear or a connection seems inactive, contact your platform manager.

## How do noise sensors and noise alerts work?

Noise sensors (from Minut, or compatible sensors) monitor a property's sound level continuously, without recording conversations — only decibel levels are measured. In a sensor's detail view (Properties, Connected Objects tab, Noise sensors category), you will find: the current sound level, a tracking curve with the thresholds displayed, a Configuration sub-tab to adjust the property's thresholds, and a History sub-tab listing past alerts. When noise exceeds the configured threshold (a party, nighttime disturbance), an alert is triggered and the host is notified: they can then contact the guest through messaging before the situation escalates with the neighborhood. Some sensors also report temperature. Roles involved: host and managers view, configure thresholds and receive alerts.

## How do smart locks and access codes work?

Smart locks (from Nuki) enable access without a physical key: an access code is associated with each reservation, communicated to the guest, and renewed automatically between stays for security. In a lock's detail view (Properties, Connected Objects tab, Locks category), you track the lock's state in real time and manage the origin of the access code: either Baitly generates the code and pushes it to the lock, or the lock generates its own code and Baitly retrieves it — the change applies to upcoming reservations. If the property has a digital welcome guide, door unlocking can be offered to the guest from their guide. For handing over physical keys, the KeyNest service (a network of key drop-off and exchange points) is also integrated. For security, no access code is ever sent by email to field workers.

## Are cameras and thermostats available?

The Connected Objects hub includes Cameras (video supervision of properties, for example to monitor an entrance or verify an arrival) and Thermostats (thermal comfort) spaces. These two categories are presented as previews: the screens give a foretaste of the experience to come during the progressive rollout of these features. An important reminder about privacy: cameras only concern the properties' exteriors and access points, never private spaces, in accordance with rental platform rules and regulations. As with other connected objects, enabling video services is the platform managers' responsibility; the host then finds their devices in the Connected Objects tab of their properties.

## Frequently asked questions

**Does a noise sensor record guests' conversations?**
No. It only measures the sound level in decibels; no audio is recorded. This is what makes it compliant and accepted in rentals.

**How can I be warned if my guests are making too much noise?**
Install a noise sensor and set the property's thresholds in the sensor's detail view (Configuration sub-tab): if exceeded, an alert is triggered and you are notified, with the history available for review.

**Can I connect my Minut or Nuki account myself?**
No, these connections are managed by the platform (super admin and super manager, Integrations tab of Settings). Only Netatmo is connected per host, from the Connected Objects hub, after activation by the administrator.

**Does the lock code change with each reservation?**
Yes, each reservation has its own code, renewed automatically. You choose whether the code is generated by Baitly and pushed to the lock, or generated by the lock itself.

**Where does the guest find their access code?**
In their arrival instructions (the door code is automatically included in the digital welcome guide); on a compatible lock, unlocking can also be done from the guide.
