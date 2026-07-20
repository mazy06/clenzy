# Tourist tax and fiscal settings

## How do I configure the tourist tax in Baitly?

The tourist tax is configured in Settings, Fiscal tab, "Tourist tax rates" section (editing is restricted to administrators — super admin and super manager). You enter your municipal rates: a default rate for the whole organization, and if needed specific rates per property (the default rate applies to all properties that do not have their own rate). Each rate specifies the municipality and its INSEE code, the calculation mode, the amount, any surcharges and its active or inactive status. Warning: without any rate configured, the tourist tax is not calculated for any reservation. A rate can also set a maximum number of taxed nights and the exemption of minors under 18, in accordance with French regulations.

## Which tourist tax calculation modes are available?

Three modes cover the French cases: for a classified accommodation, the "fixed amount per person per night" mode (you enter the municipal rate per person); for an unclassified accommodation, the "actual rate" mode as a percentage of the nightly price per person, with a cap per person per night; and a flat-rate mode per night. On top of these come the additional taxes: the departmental tax (typically 10 percent of the amount) and, where applicable, the additional regional tax. The minor exemption option automatically removes those under 18 from the calculation. Enter the rate published by your municipality (municipal resolution): Baitly then applies the calculation automatically to each reservation.

## How is the tourist tax calculated on a reservation?

The calculation is automatic as soon as a rate applies to the property: Baitly determines the tax from the number of people, the number of nights, the price and the rate's mode (fixed amount, capped percentage or flat rate), adding the departmental and regional surcharges and applying the minor exemption if enabled. On the direct booking engine, the tourist tax appears as a separate line in the price breakdown shown to the guest (next to the subtotal and cleaning fees) and is collected together with the stay, then reflected on the invoice. For reservations coming from platforms that collect and remit the tax themselves (such as Airbnb in most French municipalities), the platform handles the collection: check with the channel concerned to know who collects what.

## How do I declare the tourist tax (report by period)?

The tourist tax section offers a "Report by period" designed for your declaration: choose the "From" and "To" dates, then generate the report. It lists the confirmed reservations whose departure falls within the period, with for each one the property, the guest, the departure date, the number of nights, the number of people, the municipality and the calculated tax, as well as the total collected. A CSV export lets you transmit or reprocess the data for the declaration to your municipality. If some reservations in the period have no applicable rate, a warning flags it: they are not counted in the report — remember to complete your rates and then regenerate the report.

## How do I configure my organization's fiscal profile?

In Settings, Fiscal tab (restricted to administrators), the fiscal profile defines your organization's fiscal identity: country, currency, tax regime, tax number, VAT number and VAT liability with its declaration frequency, legal name and legal address, invoice language, numbering prefix and legal notices. This information directly feeds your invoices (legal notices, seller details) and billing compliance. A "tax rules" section manages VAT rates by service category, with a tax name, a percentage rate, a country and a validity period.

## How do I track my VAT amounts (fiscal reporting)?

Fiscal reporting presents your totals by period — monthly, quarterly or annual: number of invoices, total excluding tax, total tax and total including tax, with a breakdown by category and by rate (taxable base, tax amount, number of lines). It serves as the basis for your VAT declarations and for consistency checks against your accounting. To go further, the Billing page offers accounting exports (CSV, FEC export for the French tax administration) and the Invoices page summarizes the amounts excluding tax, VAT and including tax for each document.

## Frequently asked questions

**Why doesn't the tourist tax appear on my reservations?**
Most likely no rate applies to the property: check in Settings, Fiscal tab, that a default rate or a property-specific rate is configured and active.

**My property is not classified — which mode should I choose?**
The "actual rate" mode: a percentage of the nightly price per person, capped per person per night according to your municipality's rate.

**Do children pay the tourist tax?**
No, if the minor exemption option is enabled on the rate: those under 18 are excluded from the calculation.

**Airbnb already collects the tax — do I have to declare it as well?**
In most French municipalities, Airbnb collects and remits it directly. Your Baitly report is then mainly useful for direct reservations and channels that do not collect.

**Who can modify the rates and the fiscal profile?**
Administrators (super admin and super manager). Other roles do not have access to the Fiscal tab in the settings.
