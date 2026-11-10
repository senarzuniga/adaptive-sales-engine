# SAICA recipe-management service — offer staging package

**Status:** local draft package only; not yet saved to an active ASE Lovable company workspace and not issued to SAICA.

## Files

- `OFF-2026-S138_SAICA_Recetas_DRAFT.json` — offer-shaped header, cost breakdown, package, recurring-cost reference and source/approval notes for ASE hand-entry/review.
- Updated customer copy: `C:\Users\isena\Documents\INGECART\POSTVENTA\SAICA\OFF-2026-S138_SAICA_Estacion_Gestion_Recetas_DRAFT.docx` (Rev.2 draft; pre-revision backup retained beside it).
- Synchronized commercial copy: `C:\Users\isena\Documents\INGECART\COMMERCIAL\PROYECTOS\SAICA\OFF-2026-S138_Recetas\OFF-2026-S138_SAICA_Estacion_Gestion_Recetas_DRAFT.docx`.

## Numbering and price

- `OFF-2026-S138` is a **proposed** next service number based on known Smart Plant references S133–S137. ASE's current browser workspace had no selected company; the active company-scoped offer history could not be checked. Confirm number availability before saving/issuing.
- Base cost midpoint: €15,447 = 206 h × €62/h + estimated core hardware; €62/h is the PDF range midpoint and is not an approved rate.
- Working draft one-time price: €20,853.45, applying the ASE service-reference 35% markup to midpoint cost. This is not a confirmed Saica price, gross margin, or after-tax margin. Validate the cost policy and selling price inside ASE before saving.
- ASE currently rounds key saved contract-value and cost fields to whole euros (`Math.round` in the offer save path). If the final approved price retains cents, verify the exported Word and saved ASE value are reconciled (or approve a whole-euro quote such as €20,853) before issue.
- Optional monitor and annual licenses are shown separately in the JSON/Word document; recurring licenses are not part of the one-time contract total.
- The core customized recipe-station price is the only project total. Standard annual maintenance/TPM/support (including 3 × 4-day visits, 12 engineering reports and up to 165 remote-support hours) appears only as an optional separately priced service. Remote response/mobilization targets are not guarantees of repair completion.

## Persistence boundary

The local ASE Lovable instance showed no company selected and warned that Supabase is not configured. This staging JSON is **not** registered in the app database/local workspace. No company was created to avoid duplicating an existing INGECART profile in a separate browser profile; no Supabase/remote write, email, publication, or client contact occurred. Open the intended ASE company workspace, confirm there is no S138 collision, create/save the offer as a local draft, and then update this package with the actual offer ID and saved status.
