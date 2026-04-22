# Intake Form Review Summary LWC

Reusable Salesforce LWC that renders a review/summary view for intake forms in **OmniStudio OmniScripts** and **Record Pages**. Label-driven display, configurable section order, Budget and Document Review sections, and WCAG 2.1 AA–oriented markup.

## Table of Contents

* [Components](#components)
* [How to Use](#how-to-use)
* [OmniScript Set Values](#omniscript-set-values)
* [Deployment](#deployment)
* [Label JSON](#label-json)
* [Conditional visibility (_visibleWhen)](#conditional-visibility-_visiblewhen)
* [More Documentation](#more-documentation)

## Components

| Component | Purpose |
|:----------|:--------|
| **intakeFormReviewSummary** | Main review/summary; uses `labelData` + form data. |
| **budgetDisplayReadOnly** | Read-only budget; uses `IntakeFormReviewSummaryController.getBudgetDetail`. |
| **unifiedDocumentDisplay** | Read-only documents (LPI + GRANTS); uses `IntakeFormReviewSummaryController.getDocuments` (or legacy `getDocumentDetail`). |
| **IntakeFormReviewSummaryController** | Apex; `getBudgetDetail`, `getDocumentDetail`, `getDocuments` (OmniStudio interface). |

## How to Use

1. Deploy the project: `sf project deploy start -x manifest/package.xml -o <org-alias>`.
2. Deploy Custom Metadata Type `Form_Review_Config__mdt` (or create in Setup with Label JSON, Form Type, Is Active, Description).
3. Create a Custom Metadata record: Form Review Config → New → set Label, Name, Form Type, Is Active, and paste label JSON into **Label_JSON__c**.
4. Create DataRaptor Extract `DRExtractLabelJSON`: extract `Form_Review_Config__mdt.Label_JSON__c` → output `labelData`, filter by `DeveloperName` = `:configDeveloperName` and `Is_Active__c` = true.
5. Create Long Text Area fields on your object (one per step) to store each step’s form JSON.
6. Create DataRaptor Extract for form data: extract those Long Text fields, filter by record Id, map output paths to the same keys as in labelData (e.g. `StepName_Step`).
7. Create OmniScript: SetValues (e.g. `configDeveloperName`, `recordId`) → DRExtractLabelJSON (input `configDeveloperName`) → DRExtract form data (input `recordId`) → Step with Custom LWC `intakeFormReviewSummary`.
8. Activate OmniScript and Preview; set Record Id on Budget/Document components when used standalone or in review summary.

## OmniScript Set Values

In the OmniScript **Set Values** step, use **`elementValueMap`** (or equivalent) so the LWC and DataRaptors get the right **config**, **record id**, and **org flavor**. The review summary reads **`Org_Type`** to show the correct synthetic sections (Budget vs Document) and to drive **`c-unified-document-display`** (`LPI` vs `GRANTS`).

| Key | Role |
|:----|:-----|
| **`isPortalUser`** | Expression such as `=%userProfile% != "System Administrator"` so you can branch portal vs internal behavior. |
| **`configDeveloperName`** | **Form_Review_Config__mdt** `DeveloperName` for label JSON (e.g. `Permit_BuildingSingleDetached`). |
| **`Org_Type`** | **`LPI`** or **`GRANTS`**. Must match the program; affects document/budget wiring and which **SECTION_CONFIG** steps apply. |
| **`recordID`** | Record context for extracts and child LWCs. Typical pattern: portal users use **`parid`** when `Org_Type` is `LPI` and **`proposal`** when `GRANTS`; internal users use **`ContextId`**. Adjust merge fields to match your OmniScript. |

Example **`elementValueMap`** (expressions use your OmniScript merge-field / formula syntax):

```json
{
  "isPortalUser": "=%userProfile% != \"System Administrator\"",
  "configDeveloperName": "Permit_BuildingSingleDetached",
  "recordID": "=IF(%isPortalUser%, IF(%Org_Type% == \"LPI\", %parid%, %proposal%), %ContextId%)",
  "Org_Type": "LPI"
}
```

For a **GRANTS** flow, set **`Org_Type`** to **`GRANTS`** (and ensure **`recordID`** / proposal merge fields align with your script).

## Deployment

* Deploy all: `sf project deploy start -x manifest/package.xml -o <org-alias>`.
* Deploy LWCs: `sf project deploy start -p force-app/main/default/lwc/<componentName> -o <org-alias>` (e.g. intakeFormReviewSummary, budgetDisplayReadOnly, unifiedDocumentDisplay).
* Deploy Apex: `sf project deploy start -p force-app/main/default/classes/IntakeFormReviewSummaryController.cls -o <org-alias>`.
* Deploy Custom Metadata: `sf project deploy start -p force-app/main/default/objects/Form_Review_Config__mdt -o <org-alias>` and `sf project deploy start -p force-app/main/default/customMetadata -o <org-alias>`.
* Retrieve: `sf project retrieve start -x manifest/package.xml -o <org-alias>`.

**Manifest:** ApexClass (IntakeFormReviewSummaryController), CustomObject (Form_Review_Config__mdt), CustomMetadata (MAEOED_Proposal_Config, NB_Teacher_Certification_Config), LightningComponentBundle (budgetDisplayReadOnly, unifiedDocumentDisplay, intakeFormReviewSummary), OmniScript (POC_reviewsummary_English_2).

## Label JSON

* Label JSON must mirror your form data structure: same section/block/field keys (case-sensitive). Use **`_dataKey`** on a section when the form data key differs (e.g. label key `ProjectedOutcomesStep` → form key `ProgramOutcomesStep`).
* Use `_sectionTitle` and `_order` on sections; `_blockTitle` and `_order` on blocks; optional **`_fieldOrder`** (array of field keys) to control block field order.
* Field value = label string or `{ "label": "...", "type": "phone"|"email"|"currency"|"date"|"boolean"|"number"|"multiselect" }`. Semicolon-separated values or `type: "multiselect"` render as pills.
* Address blocks (key/title containing "address") show only the full-address value; use **`_addressColspan`** (1–12) on the block to set width.
* Budget/Document sections are driven by **SECTION_CONFIG** in the LWC (`isVisible`, `order`); set `isVisible: true` to show them.
* To generate label JSON from data JSON, use **[label-json-generation-prompt.md](label-json-generation-prompt.md)**.

## Conditional visibility (`_visibleWhen`)

### Rule shapes

Any **section**, **block**, **array** wrapper, **array item** template, or **field** label object can carry **`_visibleWhen`** (or **`visibleWhen`**). If it evaluates to **false**, the item is **not rendered**. In **edit** mode, a hidden field’s value is **cleared** from the **draft** (so **Save** will not persist it).

### Simple comparison

```json
{
  "label": "Business Number",
  "type": "text",
  "_visibleWhen": { "path": "Applicant.Type", "op": "eq", "value": "Corporation" }
}
```

### Shorthand (common case)

```json
{
  "label": "Spouse Name",
  "_visibleWhen": { "field": "MaritalStatus", "equals": "Married" }
}
```

### Groups (AND / OR, nestable)

```json
{
  "_visibleWhen": {
    "all": [
      { "path": "Applicant.Country", "op": "eq", "value": "Canada" },
      { "any": [
          { "path": "Applicant.Province", "op": "in", "value": ["AB", "BC"] },
          { "path": "Applicant.Type", "op": "eq", "value": "Partnership" }
      ] }
    ]
  }
}
```

### Non-empty controller

```json
{ "_visibleWhen": { "path": "Applicant.MailingAddress", "op": "isNotEmpty" } }
```

### Supported operators

| Operator | Meaning |
|:---------|:--------|
| `eq` / `neq` | equals / not equals (loose, boolean-aware) |
| `equals` / `notEquals` | shorthand keys (same idea as eq / neq) |
| `contains` / `startsWith` | case-insensitive substring match |
| `isEmpty` / `isNotEmpty` | `null`, empty string, or empty array |
| `gt` / `lt` / `gte` / `lte` | numeric comparison |
| `in` / `notIn` | value membership in an array |
| `all` / `any` | nestable group combinators (AND / OR) |

### Where rules live

| Level | Key goes on |
|:------|:-------------|
| **Section** | The section’s top-level label object (same object that can carry `_sectionTitle`) |
| **Block** | The block’s label object (same one that holds `_blockTitle`) |
| **Array wrapper** | The array’s label object (hides the entire block) |
| **Array item template** | Inside the item template labels (also hides the entire block) |
| **Field** | The field’s label object |

### Paths

`path` (or `field`) is a **dotted path** resolved against the **merged root**:

* **Draft** takes precedence for any section currently in **edit** mode.
* Then **committed** `_formData`, then **`omniJsonData`**.

You can reference values such as `Applicant.Address.Country`, top-level `Org_Type`, `userProfile`, etc.

### Reactive behavior (edit mode)

* In edit mode, **lightning-input** change events trigger a **re-process** so conditions re-evaluate **without** a Save round-trip.
* For **text** inputs this often fires on **blur**; for **checkboxes** / **dates** / **pickers**, on **commit**. **Focus** is preserved because the DOM tree stays stable.
* When a **controller** changes and a controlled field **becomes hidden**, its value is **cleared** from the draft on that **same** render pass. **Re-showing** it later starts it **blank**.

### Example: end-to-end — label JSON for an Applicant section

```json
{
  "Applicant": {
    "_sectionTitle": "Applicant Information",
    "_order": 1,
    "Type": { "label": "Applicant Type", "type": "text" },
    "IncorporationNumber": {
      "label": "Incorporation Number",
      "type": "text",
      "_visibleWhen": { "field": "Applicant.Type", "equals": "Corporation" }
    },
    "DirectorDetails": {
      "_blockTitle": "Director Details",
      "_visibleWhen": { "path": "Applicant.Type", "op": "in", "value": ["Corporation", "Partnership"] },
      "DirectorName": { "label": "Director Name", "type": "text" },
      "DirectorEmail": { "label": "Director Email", "type": "email" }
    }
  },
  "SoleProprietorDetails": {
    "_sectionTitle": "Sole Proprietor",
    "_visibleWhen": { "path": "Applicant.Type", "op": "eq", "value": "Sole Proprietor" },
    "OwnerName": { "label": "Owner Name", "type": "text" }
  }
}
```

**Longer walkthroughs:** [README-FULL.md](README-FULL.md#conditional-visibility-_visiblewhen) (same content, plus context with other label topics).

## More Documentation

* **Full documentation (step-by-step setup, label format, conditional visibility, API, troubleshooting):** [README-FULL.md](README-FULL.md).
* **Conditional visibility (`_visibleWhen`):** [README](README.md#conditional-visibility-_visiblewhen) · [Full reference](README-FULL.md#conditional-visibility-_visiblewhen)
* **Section order:** Form sections use `_order` in labelData; Budget/Document order is in `SECTION_CONFIG` in `intakeFormReviewSummary.js` (e.g. 4.5, 4.6); all sections are sorted by numeric `order`.
* **Generate label JSON from data:** Use [label-json-generation-prompt.md](label-json-generation-prompt.md) with Gemini/ChatGPT.
* **API version:** 65.0.

## License

MIT License — see [LICENSE](LICENSE).
