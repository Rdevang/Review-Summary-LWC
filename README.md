# Intake Form Review Summary LWC

Reusable Salesforce LWC that renders a review/summary view for intake forms in **OmniStudio OmniScripts** and **Record Pages**. Label-driven display, configurable section order, Budget and Document Review sections, and WCAG 2.1 AA–oriented markup.

## Table of Contents

* [Components](#components)
* [How to Use](#how-to-use)
* [Deployment](#deployment)
* [Label JSON](#label-json)
* [More Documentation](#more-documentation)

## Components

| Component | Purpose |
|:----------|:--------|
| **intakeFormReviewSummary** | Main review/summary; uses `labelData` + form data. |
| **budgetDisplayReadOnly** | Read-only budget; uses `IntakeFormReviewSummaryController.getBudgetDetail`. |
| **documentDisplayReadOnly** | Read-only documents; uses `IntakeFormReviewSummaryController.getDocumentDetail`. |
| **IntakeFormReviewSummaryController** | Apex; `getBudgetDetail`, `getDocumentDetail` (OmniStudio interface). |

## How to Use

1. Deploy the project: `sf project deploy start -x manifest/package.xml -o <org-alias>`.
2. Deploy Custom Metadata Type `Form_Review_Config__mdt` (or create in Setup with Label JSON, Form Type, Is Active, Description).
3. Create a Custom Metadata record: Form Review Config → New → set Label, Name, Form Type, Is Active, and paste label JSON into **Label_JSON__c**.
4. Create DataRaptor Extract `DRExtractLabelJSON`: extract `Form_Review_Config__mdt.Label_JSON__c` → output `labelData`, filter by `DeveloperName` = `:configDeveloperName` and `Is_Active__c` = true.
5. Create Long Text Area fields on your object (one per step) to store each step’s form JSON.
6. Create DataRaptor Extract for form data: extract those Long Text fields, filter by record Id, map output paths to the same keys as in labelData (e.g. `StepName_Step`).
7. Create OmniScript: SetValues (e.g. `configDeveloperName`, `recordId`) → DRExtractLabelJSON (input `configDeveloperName`) → DRExtract form data (input `recordId`) → Step with Custom LWC `intakeFormReviewSummary`.
8. Activate OmniScript and Preview; set Record Id on Budget/Document components when used standalone or in review summary.

## Deployment

* Deploy all: `sf project deploy start -x manifest/package.xml -o <org-alias>`.
* Deploy LWCs: `sf project deploy start -p force-app/main/default/lwc/<componentName> -o <org-alias>` (e.g. intakeFormReviewSummary, budgetDisplayReadOnly, documentDisplayReadOnly).
* Deploy Apex: `sf project deploy start -p force-app/main/default/classes/IntakeFormReviewSummaryController.cls -o <org-alias>`.
* Deploy Custom Metadata: `sf project deploy start -p force-app/main/default/objects/Form_Review_Config__mdt -o <org-alias>` and `sf project deploy start -p force-app/main/default/customMetadata -o <org-alias>`.
* Retrieve: `sf project retrieve start -x manifest/package.xml -o <org-alias>`.

**Manifest:** ApexClass (IntakeFormReviewSummaryController), CustomObject (Form_Review_Config__mdt), CustomMetadata (MAEOED_Proposal_Config, NB_Teacher_Certification_Config), LightningComponentBundle (budgetDisplayReadOnly, documentDisplayReadOnly, intakeFormReviewSummary), OmniScript (POC_reviewsummary_English_2).

## Label JSON

* Label JSON must mirror your form data structure: same section/block/field keys (case-sensitive). Use **`_dataKey`** on a section when the form data key differs (e.g. label key `ProjectedOutcomesStep` → form key `ProgramOutcomesStep`).
* Use `_sectionTitle` and `_order` on sections; `_blockTitle` and `_order` on blocks; optional **`_fieldOrder`** (array of field keys) to control block field order.
* Field value = label string or `{ "label": "...", "type": "phone"|"email"|"currency"|"date"|"boolean"|"number"|"multiselect" }`. Semicolon-separated values or `type: "multiselect"` render as pills.
* Address blocks (key/title containing "address") show only the full-address value; use **`_addressColspan`** (1–12) on the block to set width.
* Budget/Document sections are driven by **SECTION_CONFIG** in the LWC (`isVisible`, `order`); set `isVisible: true` to show them.
* To generate label JSON from data JSON, use **[label-json-generation-prompt.md](label-json-generation-prompt.md)**.

## More Documentation

* **Full documentation (step-by-step setup, label format, API, troubleshooting):** [README-FULL.md](README-FULL.md).
* **Section order:** Form sections use `_order` in labelData; Budget/Document order is in `SECTION_CONFIG` in `intakeFormReviewSummary.js` (e.g. 4.5, 4.6); all sections are sorted by numeric `order`.
* **Generate label JSON from data:** Use [label-json-generation-prompt.md](label-json-generation-prompt.md) with Gemini/ChatGPT.
* **API version:** 65.0.

## License

MIT License — see [LICENSE](LICENSE).
