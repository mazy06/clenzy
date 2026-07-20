# Billing and payments (Stripe, invoices, commissions, payouts)

## Where do I manage billing and payments in Baitly?

The Billing page in the menu gathers all the money side of your business: Payments, Invoices, Payouts, Expenses, Provider payouts, Reports & Exports and Accounting Exports tabs. The payment history lists each transaction with its status (paid, pending, failed, refunded), totals (collected, pending, refunded) and filters by period, status or host. The Invoices page presents your invoices (or notes) with their statistics and lets you issue them, mark them paid or download the PDF. Management contracts, which determine who collects the money and which commission applies, have their own Management Contracts page. Payment providers are configured in Settings, Payment tab (restricted to administrators).

## How do my guests pay for a direct reservation?

On the direct booking engine, the guest pays online by card through a secure payment (Stripe). The reservation is created as pending and then confirmed automatically upon payment: invoice generated, confirmation email sent, dates blocked on the channels. You can also collect payment without going through the website: when creating a reservation manually, choose "Create & send payment link" — the guest receives a secure payment link by email, and the dates are definitively blocked once payment is made. For deferred payment (a deposit at booking and the balance later), automatic reminders exist: if a deferred balance fails or is overdue, a new payment link can be regenerated and sent automatically to the guest.

## How do invoices work (numbering, statuses, credit notes)?

Baitly invoices follow a cycle: Draft, Issued, Paid, Cancelled. Numbering is sequential and gapless, compliant with French tax requirements: once issued, an invoice is tamper-proof — it can no longer be modified. To correct an issued invoice, you create a credit note that cancels or rectifies it in the accounts. Each invoice carries the legal notices, the seller's and buyer's details, and the amounts excluding tax, VAT and including tax. The PDF can be downloaded from the Invoices page. An invoice is generated automatically when a direct reservation is paid. Reminders can be issued for invoices that have reached their due date. There are also commission invoices, issued by the property manager to the owner under a management contract.

## Why is my Airbnb or Booking reservation marked as "paid"?

Reservations imported from a platform (Airbnb, Booking.com, Vrbo...) have already been collected by that platform: the guest paid on the channel, and the channel pays you out according to its own rules. Baitly does not touch this money flow: the reservation is therefore displayed as paid from the moment it is imported, and a corresponding invoice is generated automatically for your accounting. Do not try to re-collect an OTA stay through a payment link: only the amount due directly (for example an extra option sold, or the tourist tax if the channel does not collect it) can be subject to an additional collection.

## Who collects the money? Management contracts and commission

The Management Contracts page defines, for each property, the contract between owner and property manager: management type, commission rate (total percentage retained on revenue), period, minimum stay, notice period, automatic renewal, cleaning and maintenance included. The contract's collection mode drives the automatic distribution of revenue: direct collection by the platform, collection by the owner, collection by the property manager, or co-host split on OTA channels. A preview shows the distribution between owner, platform and property manager. Upon creation, an electronic signature link is sent to the owner by email; once the contract is activated, the distribution applies automatically to payments. Without a contract, payments are split into two shares (owner and platform). Owner payouts follow a pending, approved, paid cycle, with a configurable payout schedule and owner statements.

## How do I handle refunds and the security deposit?

A collected payment can be refunded; it then appears with the "refunded" status in the payment history and the refunded total is tracked over the period. As for the security deposit, Baitly uses a card pre-authorization (hold) rather than a charge: no amount is debited as long as there is no damage. Automations can release the deposit automatically after the guest's departure, or release it after a cancellation — in both cases without any debit. For your accounting, the Billing page offers exports: accounting reports, CSV exports and FEC export (the accounting entries file for the French tax administration); a synchronization with the Pennylane accounting tool is also available.

## Frequently asked questions

**Can I modify an invoice that has already been issued?**
No. An issued invoice is tamper-proof; correct it by creating a credit note, then issue a new invoice if necessary.

**How do I collect payment from a guest who books by phone?**
Create the reservation manually and choose to send a payment link: the guest pays online and the reservation is confirmed automatically.

**Why don't I see any money collected for my Airbnb reservations?**
The guest paid Airbnb, which pays you the amount directly. Baitly marks the reservation as paid and generates the invoice, but does not collect this flow.

**Where is my property management commission defined?**
In the property's management contract: the commission rate and collection mode there determine the automatic distribution between owner, property manager and platform.

**Is the security deposit charged to the guest?**
No, it is a card pre-authorization. It is released automatically after departure (or after cancellation) if nothing is withheld.
