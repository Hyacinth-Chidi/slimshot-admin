# Overview: Users and Credits spent in place of Processing and Failed

2026-11-16. Approved by the owner in conversation ("lets go with your pick").

## Intent

The Overview's Processing and Failed cards sit at 0 almost all the time. The owner
wants the two numbers that say how the app is doing in their place: its users and
its credits.

## What changes

The dashboard only. The server already answers both numbers.

- **Users**, the third card: the accounts that exist (deleted ones left out) and,
  under it, "+56 this week". 0 new reads "No sign-ups this week". From
  `GET /stats/users?days=7` (`{ total, newInPeriod }`, `users.read`), which was
  built on 2026-10-29 for this card and never used. Opens `/users`.
- **Credits spent**, the fourth card: credits used on paid features over the
  last 30 days, with refunds taken off, and "5,100 given" under it: the free
  credits handed out (sign-up bonus, invites, ads, daily claims, admin top-ups),
  never refunds or purchases. From the 30 days of `GET /stats/credits` the page
  already loads for its credits chart, so it costs no new request. Opens
  `/credits/pricing`, the Credits section's first page.
- **Failed, without its card.** When an upload has failed, Total assets adds
  "· 2 failed", a link to the failed assets, and takes the rose border the Failed
  card had. Failed processing jobs keep the warning strip at the top.

## Approaches

The open choice was the credit number the card leads with:

- **Spent** (chosen): how much the paid features are used.
- **Given**: what the free credits cost.
- **Held**: credits in balances now. Needs a new server count.

The owner took Spent, with Given as the card's second line.

## Non-goals

- No split by feature on the card: the stats are kept by type, not by feature.
- No list of credit ledger entries.

## Calls made by the builder

- Users wears a new sky accent (`#38BDF8`, the 400 step like the other four).
  Violet, emerald and amber belong to the other cards, and rose is the alarm.
- Credits spent wears amber, the colour of the app's credit coin.
- Only the two new cards are links. Total assets holds its own "failed" link,
  and a link cannot hold another.
