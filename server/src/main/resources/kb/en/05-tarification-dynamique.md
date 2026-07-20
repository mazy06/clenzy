# Pricing and dynamic rates in Baitly

## Where do I manage my properties' prices?

Nightly pricing is managed on the Dynamic Pricing page (also accessible from the Properties page, Dynamic Pricing tab). It is organized into three tabs: By property (a given property's rate plans and price calendar), Overview (a panorama of prices across the portfolio) and Yield (automatic adjustment rules based on occupancy). First select a property in the filter to view and adjust its price calendar; an owner filter helps you navigate if you manage properties for several hosts. The starting point for any property is its nightly price, defined on its detail page (Properties menu): it is the fallback price used when no pricing rule applies. Everything else (seasons, promotions, specific prices, yield) refines this base price.

## How do I define a base price and seasonal prices?

In Dynamic Pricing, By property tab, the Rate plans section lets you create plans with the New plan button. Each plan has a name, a type, a nightly price, a priority, an application period (start date and end date) and optionally targeted days of the week; it can be active or inactive. Four plan types exist: Base (the property's standard rate), Seasonal (a different price for a season, for example summer or school holidays), Promotion (a reduced rate over a period) and Last minute (a rate for reservations close to the arrival date). Example: a Base plan at 80 euros per night all year round, a Seasonal plan at 120 euros from July to August, a Promotion plan at 65 euros over a slow fortnight. You can edit or delete a plan at any time; an inactive plan is kept but ignored in the calculation.

## How do I set a one-off price on a specific date (override)?

To depart from the calculated rate on one or more specific nights, use specific prices (manual overrides). In Dynamic Pricing, By property tab, the Specific prices section offers Add a specific price for a date, or Apply over a period to set the same price across a date range. You can also click directly on a day in the price calendar and choose Edit price. A specific price takes priority over everything else: it wins over promotions, seasonal prices and the base plan. It is the ideal tool for a local event (festival, trade fair, public holiday) where you want to set a precise amount by hand. The price calendar shows, for each night, the source of the displayed price: Manual (specific price), Promotion, Seasonal, Last minute, Base plan or the property's default price. To return to the calculated price, simply delete the specific price.

## In what order do pricing rules apply?

For each night, Baitly resolves the price in a cascade, from the highest priority to the most general: first any specific price set by hand (always wins), then the plans in priority order, promotion before seasonal price, last minute applying as the arrival date approaches, then the base plan; in the absence of any plan, the nightly price from the property's detail page applies. The source retained is visible on the price calendar, night by night, so you can understand where each displayed amount comes from. This nightly price is then supplemented, at booking time, by ancillary fees (cleaning fees, tourist tax per person per night) which are not part of the nightly price. Resolved prices are also distributed to your connected channels through synchronization, so your external listings reflect the same rate grid.

## How do yield rules work (automatic adjustment based on occupancy)?

The Yield tab of the Dynamic Pricing page automates price adjustments according to occupancy. You create occupancy rules such as: "if occupancy is below 40% at 30 days, lower by 5%" or "if occupancy is above 85% at 60 days, raise by 10%". Each rule defines a scope (all properties or one specific property), a condition (occupancy below or above a percentage threshold, measured over a horizon in days), a percentage adjustment (decrease or increase) and a per-day adjustment cap, and can be enabled or disabled. Three execution modes exist: Simulation (a report of what would have changed, no pricing writes), Suggestion (proposals to approve, amounts recalculated at the time of application) and Automatic (adjustments applied directly). A general "Automatic yield enabled" switch lets you turn everything off in one move.

## What safeguards prevent absurd prices with automatic yield?

Automatic yield is framed by per-property safeguards: for each property, you define a floor price and a ceiling price in euros. Both bounds are required for yield to act: without a floor and a ceiling filled in, the property is simply ignored by the automatic rules (and the exclusion is logged). Automatic mode can therefore never go below your floor nor exceed your ceiling, and the per-day adjustment cap limits the daily amplitude of variations. An adjustment log traces everything yield has done or proposed: for each entry, the evaluation date, the night concerned, the property, the mode, the price before and after, the observed occupancy rate and the details of the decision. Tip: start in Simulation mode to observe how the rules behave, move to Suggestion to validate case by case, then to Automatic once you are confident.

## Frequently asked questions

**Which price applies if I have not configured any rate plan?**
The nightly price defined on the property's detail page. Plans and specific prices only refine this fallback rate.

**Is a specific price overwritten by automatic yield?**
The specific price is the highest-priority level of the grid: your manual decision prevails over calculated pricing.

**Can I test my yield rules without touching my prices?**
Yes, choose Simulation mode: Baitly produces a report of what would have changed, without any pricing writes.

**Can I use an external pricing tool?**
Yes, Baitly offers an integration with market dynamic pricing solutions such as PriceLabs, which can then drive your properties' prices.

**How do I run a one-off discount to fill a slow period?**
Create a Promotion-type plan over the targeted period, or a yield decrease rule conditioned on low occupancy, or a specific price applied over the period.
