# International Paper Waterloo — OFF-2026-R120 Rev.3 draft

**Status:** non-issuable review draft. Existing Rev.2 must be preserved; this file is a new revision proposal, not an ASE-saved record.

## Files

- `OFF-2026-R120_Rev3_IP_Waterloo_Spares_DRAFT.json` — offer-shaped header, ten line items, source totals and reconciliation hold.
- `INGECART_IP_Waterloo_Critical_Spare_Parts_OFF-2026-R120_Rev3_DRAFT.docx` — formatted English offer draft.

## Discrepancy hold

The ten supplied line extensions calculate to **EUR 17,489.06** and line quantities sum to **28**. The requested total row states **EUR 23,336.14** and quantity **38**. Difference in price is **EUR 5,847.08** and quantity differs by **10 units**. The previously saved OFF-2026-R120 Rev.2 was independently reported with a different stated total of **EUR 17,286.03**. Do not issue or mark the revision final until the authoritative BOM, total and quantity are reconciled.

The Word draft retains the line-level selling prices as provided, labels the calculated line sum and carries an internal reconciliation note. Remove that note and regenerate the final customer-facing version only after written commercial approval.

## Terms requiring approval

- Select FCA Barcelona **or** EXW workshop and identify named place; do not state both as concurrent delivery bases.
- Confirm supplier availability and 8-week delivery estimate.
- Replace the invalid/ambiguous historic text `F000 DEMAND PAYMENT` with approved payment terms.
- Confirm validity, tax/VAT, freight, warranty, returns, installation/support exclusions and final quantity.

## ASE boundary

The requested `/api/v1/proposals/sync` returned HTTP 404 in the check on 2026-11-06, and no handler was found in the inspected ASE source. This package is local staging only. After reconciling, use the ASE OfferPricing builder with the intended active company workspace, confirm no number conflict, save as draft and export Word through the ASE native exporter. No email, remote API write or publication was performed.
