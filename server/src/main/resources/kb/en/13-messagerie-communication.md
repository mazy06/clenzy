# Messaging and guest communication

## Where is the messaging inbox and what does it bring together?

Baitly's unified messaging is accessible from the Contact menu. It gathers all your conversations in a single inbox: guest messages coming from connected platforms such as Airbnb and Booking ("Platform messaging"), email and WhatsApp exchanges, and internal messaging between members of the organization. Each conversation displays the full message thread, with an unread counter, search, and the ability to reply directly from Baitly — the reply goes out on the conversation's original channel. A conversation can be assigned to a team operator, marked read, or archived. Messages arrive in real time. Roles involved: hosts and managers reply to guests; restricted users can only write to the managers within their scope.

## Which communication channels are available?

Baitly handles the following channels: platform messaging (Airbnb, Booking — available when the channel is connected via the channel manager), email (transactional sending with formatting), WhatsApp (via the official Meta API), and the organization's internal messaging. WhatsApp is configured and managed at platform level: a banner in the messaging inbox shows its state (active, disabled or not configured); if WhatsApp is not active for your organization, contact your platform manager. A WhatsApp specificity: outside the 24-hour conversation window following the guest's last message, only an approved message template can be sent — Baitly flags this for you when applicable. Outgoing WhatsApp messages are signed with the host's and property's name. SMS is not an active channel in Baitly.

## How do I create and use message templates?

Message templates are managed in Documents & Communications, in the message templates tab. You can create your own templates or customize the system templates provided by Baitly. Each template has a name, a type, a language, a subject and a body; the content accepts dynamic variables (for example the guest's name or the property's name) automatically replaced at sending time with the reservation's information. A preview lets you check the rendering before saving. WhatsApp templates are a special case: they carry a Meta category and must be approved by the WhatsApp platform before use. Outgoing messages based on templates can be automatically translated into the guest's language (around thirty languages supported). The history of sent messages can be viewed in Documents & Communications, History tab. Roles involved: managers and hosts.

## How do I automate guest messages (check-in, check-out, follow-ups)?

Automatic messages are configured on the Automations page in the menu. An automation rule associates a trigger from the reservation lifecycle — reservation confirmed, check-in approaching, check-in day, check-out day, after departure, review reminder — with a message template and a sending channel. You set the offset in days and the sending time (9 a.m. by default), and can add conditions to target certain reservations. A typical example: send the arrival instructions a few hours or days before check-in, then a thank-you message after departure. Each rule keeps a history of its executions, and the same message is never sent twice for the same reservation. The old automatic check-in and check-out settings from the messaging section have been moved to this Automations page. Roles involved: managers and hosts.

## How do notifications work in Baitly?

Baitly notifies the right people as events unfold: new guest message, conversation assigned to an operator, intervention assigned (with the pay for the provider), issue reported, payout sent, various alerts. Notifications arrive in the web application's notification center (the bell), and for field teams also as push notifications on the mobile app (the notification opens the relevant mission directly) and by email for certain events such as a mission assignment. Each user adjusts their notification preferences in their Settings: a disabled notification switches off all of its channels. Confidentiality rule: everyone only sees the amounts that concern them (the provider their pay, the host the billed price), and no property access code is ever sent by email.

## Frequently asked questions

**Can I reply to an Airbnb message directly from Baitly?**
Yes, if the channel is connected via the channel manager: the conversation appears in the platform messaging and your reply is sent back to Airbnb or Booking.

**Why isn't my WhatsApp message going out?**
Either WhatsApp is not active for your organization (see the status banner in the messaging inbox, activation is managed by the platform), or the 24-hour window has expired and you must use an approved WhatsApp template.

**Can I send SMS to guests?**
No, SMS is not an active channel in Baitly. Use email or WhatsApp; automatic communications go through these channels.

**How do I send the arrival instructions automatically?**
Create a rule in Automations with the check-in approaching trigger, choose your instructions template and the channel, then set the lead time before arrival and the sending time.

**Do guests receive my messages in their language?**
Messages based on templates can be automatically translated into the guest's language; you can also create one template per language.
