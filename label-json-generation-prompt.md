# AI Prompt: Generate Label JSON from Data JSON

Use this prompt with **Gemini**, **ChatGPT**, or another AI to generate **label configuration JSON** for the Intake Form Review Summary LWC. The user provides a **data JSON** (form data or OmniScript output); the AI returns a **label JSON** that mirrors the structure and adds display labels, section/block titles, order, and formatting types.

---

## How to Use

1. Copy the **Full prompt** below (from "Role" through "User input").
2. Paste it into your AI assistant (Gemini, Claude, ChatGPT, etc.).
3. Replace the placeholder **\[Insert the user's data JSON here.\]** with the actual data JSON.
4. Run the prompt. The AI should output **only** valid label JSON.
5. Paste the result into Custom Metadata **Form_Review_Config__mdt** → **Label_JSON__c**, or use it in your OmniScript label config.

---

## Full prompt

**Role:** You are an expert at generating **label configuration JSON** for a Salesforce Intake Form Review Summary component. The label JSON defines display labels, section/block titles, display order, and formatting for a **data JSON** that has the same structure (e.g. form data or OmniScript output).

**Task:** Given a **data JSON** (the "form data" or "data JSON" the user provides), produce a **label JSON** that:

1. **Mirrors the exact structure** of the data JSON: same keys at every level. Section keys, block keys, and field keys in the label JSON must match the data JSON **exactly** (case-sensitive). Exception: if a section key in the label JSON is different from the form/data key (e.g. label key `ProjectedOutcomesStep` but data key `ProgramOutcomesStep`), add **`_dataKey`** (string) on that section with the actual data key.
2. **Uses only the rules below** for how to represent sections, blocks, and fields.
3. When the user (or the data) implies **conditional** sections, blocks, or fields, add **`_visibleWhen`** (or **`visibleWhen`**) on the right label object using the **Conditional visibility** rules below.

---

### Structure rules

**Top level (sections)**  
- Each key is a section (e.g. a step or form section).  
- For each section provide:
  - **`_sectionTitle`** (string): Human-readable section title. Derive from the section key (e.g. turn `ApplicantInfo_Step` into "Applicant Information") or from context.
  - **`_order`** (number): Display order, starting at 1 and incrementing per section (1, 2, 3, …).
  - **`_dataKey`** (string, optional): Only when the **form/data key** for this section is different from the label key. Set `_dataKey` to the key used in the actual form data (e.g. section key `ProjectedOutcomesStep` with `_dataKey: "ProgramOutcomesStep"`).
  - **`_visibleWhen`** (object, optional): If false, the **entire section** is not rendered. Use the same rule shapes as in **Conditional visibility (full specification)** below.
  - **All other keys** in that section are either **field keys** or **block keys** (see below). Do not add or remove keys; only add metadata (`_sectionTitle`, `_order`, `_dataKey`, `_visibleWhen`) and replace values with labels.

**Blocks (nested objects that are not primitives or arrays)**  
- If a value in the data JSON is an **object** (and not a single field with sub-fields like an address), treat it as a **block**.  
- For each block provide:
  - **`_blockTitle`** (string): Human-readable block title. Derive from the key (e.g. `ContactInfoBlock` → "Contact Information") or context.
  - **`_order`** (number): Order of the block within the section (1, 2, 3, …).
  - **`_fieldOrder`** (array of strings, optional): List of field keys in the order they should appear. Omit to use natural/key order.
  - **`_addressColspan`** (number, optional): For **address blocks** only (key or `_blockTitle` contains "address"). The renderer shows a single "Full Address" line. Set colspan 1–12 (default 6) for layout.
  - **`_visibleWhen`** (object, optional): If false, the **block** (or array wrapper) is not rendered.
  - **All other keys** inside the block are field keys (see below). Again, preserve the same keys as in the data; only add metadata and labels.

**Fields (leaf values: strings, numbers, booleans, or values inside arrays)**  
- If the data value is a **primitive** (string, number, boolean) or is a **field inside a block/section**, define its **display label** in one of two ways:
  - **Short form:** A single string: the human-readable label (e.g. `"ApplicantInformation_CEOName": "CEO/Executive Director Name"`).
  - **Long form (when formatting or layout is needed):** An object:
    - **`label`** (string, required): Display label.
    - **`type`** (string, optional): One of: `phone`, `email`, `currency`, `date`, `boolean`, `number`, `multiselect`. Use from value shape and naming:
      - Phone numbers (digits, or key/name contains "phone", "phoneNumber", "tel") → `phone`
      - Email-like strings or keys containing "email" → `email`
      - Money/amounts or keys like "budget", "amount", "salary", "grant" → `currency`
      - Date strings or keys like "date", "birthDate", "fiscalYearEnd" → `date`
      - true/false or keys like "isActive", "certify", "compliant" → `boolean`
      - Plain numbers (counts, EIN, etc.) → `number`
      - Semicolon-separated lists or multi-picklist values (e.g. `"A; B; C"`) → `multiselect` (renders as pills/tags)
    - **`colspan`** (number, optional): Grid column span 1–12. Use 12 for long text/descriptions, 6 as default, 4 for short fields if you want a 3-column row.
    - **`_visibleWhen`** or **`visibleWhen`** (object, optional): See **Conditional visibility (full specification)** above for rule shapes, operators, paths, and the Applicant example.

**Arrays (repeatable blocks/lists)**  
- If a value in the data JSON is an **array of objects**, the label JSON does **not** repeat the array. Use **one** block with the **same key** as in the data. Inside that block, the keys are the **property names of the objects in the array**; each key gets a label (string or `{ "label": "...", "type": "..." }`).  
- Add **`_blockTitle`** and **`_order`** for that block so it renders as a titled, ordered block (e.g. "Outcomes", "Project Timeline").  
- Example: if data has `"PartnershipsCollaboration_OutcomesList": [ { "OutcomeDescriptions": "...", "TargetPop": 100 } ]`, the label JSON has one object `"PartnershipsCollaboration_OutcomesList": { "_blockTitle": "Outcomes", "_order": 1, "OutcomeDescriptions": "Outcome Description", "TargetPop": { "label": "Target Population Count", "type": "number" } }`.

**Keys to skip or treat as internal**  
- Do **not** create label entries for keys that are clearly internal or system-only (e.g. `recordId`, `Id`, `attributes`, or keys the user says to exclude).  
- Keys starting with **`_`** in the data (if any) are metadata; you can omit them from the label JSON or keep the same key and give a neutral label; the renderer typically skips `_` keys for display.

### Conditional visibility (`_visibleWhen`) — full specification

**Rule shapes.** Any section, block, array wrapper, array item template, or field label can carry **`_visibleWhen`** (or **`visibleWhen`**). If it evaluates to false, the item is **not rendered**. In **edit** mode, a hidden field’s value is **cleared** from the draft (so Save won’t persist it).

**Simple comparison**

```json
{
  "label": "Business Number",
  "type": "text",
  "_visibleWhen": { "path": "Applicant.Type", "op": "eq", "value": "Corporation" }
}
```

**Shorthand (handy for the most common case)**

```json
{
  "label": "Spouse Name",
  "_visibleWhen": { "field": "MaritalStatus", "equals": "Married" }
}
```

**Groups (AND / OR, nestable)**

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

**Non-empty controller**

```json
{ "_visibleWhen": { "path": "Applicant.MailingAddress", "op": "isNotEmpty" } }
```

**Supported operators**

| Operator | Meaning |
|:---------|:--------|
| `eq` / `neq` | equals / not equals (loose, boolean-aware) |
| `equals` / `notEquals` | shorthand keys |
| `contains` / `startsWith` | case-insensitive substring match |
| `isEmpty` / `isNotEmpty` | null, empty string, or empty array |
| `gt` / `lt` / `gte` / `lte` | numeric comparison |
| `in` / `notIn` | value membership in an array |
| `all` / `any` | nestable group combinators |

**Where rules live**

| Level | Key goes on |
|:------|:-------------|
| Section | The section’s top-level label object (same object that can carry `_sectionTitle`) |
| Block | The block’s label object (same one that holds `_blockTitle`) |
| Array wrapper | The array’s label object (hides the entire block) |
| Array item template | Inside the item template labels (also hides the entire block) |
| Field | The field’s label object |

**Paths.** `path` (or `field`) is a dotted path resolved against the **merged** root: **draft** takes precedence for any section in edit mode, then **committed** `_formData`, then **`omniJsonData`**. Reference e.g. `Applicant.Address.Country`, `Org_Type`, `userProfile`, etc.

**Reactive behavior (edit mode).** `lightning-input` change events re-run processing so conditions update without Save. Text inputs: often on **blur**; checkboxes / dates / pickers: on **commit**; focus stays stable. When a field becomes hidden, its value is cleared on the same pass; re-shown fields start **blank**.

**Example: end-to-end — label JSON for an Applicant section**

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

---

### Output requirements

- Output **only** valid JSON. No markdown code fences, no commentary before or after.
- Preserve the **exact key names** from the data JSON at every level (sections, blocks, fields). Only add `_sectionTitle`, `_order`, `_dataKey`, `_visibleWhen` (sections), `_blockTitle`, `_order`, `_fieldOrder`, `_addressColspan`, `_visibleWhen` (blocks), and replace values with label strings or `{ "label", "type", "colspan", "_visibleWhen" }` objects as needed.
- Use the **long form** (`{ "label": "...", "type": "..." }`) for any field that should be formatted (phone, email, currency, date, boolean, number, multiselect); use the **short form** (plain string) for plain text.
- Order sections and blocks with sequential `_order` (1, 2, 3, …) in the same order as they appear in the data JSON, unless the user specifies a different order. Use `_fieldOrder` on blocks when field display order must be explicit.

---

### Example (short)

**Data JSON (fragment):**

```json
{
  "ApplicantInfo_Step": {
    "ApplicantInformation_CEOName": "John Smith",
    "ApplicantInformation_CEOEmail": "john@example.com",
    "ApplicantInformation_CEOPhone": "4105551234",
    "ApplicantInformation_AnnualBudget": 50000
  }
}
```

**Label JSON (fragment) to produce:**

```json
{
  "ApplicantInfo_Step": {
    "_sectionTitle": "Applicant Information",
    "_order": 1,
    "ApplicantInformation_CEOName": "CEO/Executive Director Name",
    "ApplicantInformation_CEOEmail": { "label": "CEO/Executive Director Email", "type": "email" },
    "ApplicantInformation_CEOPhone": { "label": "CEO/Executive Director Phone", "type": "phone" },
    "ApplicantInformation_AnnualBudget": { "label": "Annual Budget", "type": "currency" }
  }
}
```

---

**User input:**  
\[Insert the user's data JSON here.\]

**Generate the complete label JSON for the above data JSON. Output only the JSON.**

---

## Related documentation

* **Label Data Format**, **Special Properties Reference**, address blocks, multiselect, and **conditional visibility** (`_visibleWhen`): See [README.md](README.md) and [README-FULL.md](README-FULL.md), especially [README-FULL — Conditional visibility](README-FULL.md#conditional-visibility-_visiblewhen).
* **OmniScript Set Values** (`elementValueMap`, **`Org_Type`** `LPI` \| `GRANTS`, **`configDeveloperName`**, **`recordID`**): See [README.md — OmniScript Set Values](README.md#omniscript-set-values) and [README-FULL.md — OmniScript Set Values](README-FULL.md#omniscript-set-values-elementvaluemap).
* **Custom Metadata**: Store the generated JSON in **Form_Review_Config__mdt** → **Label_JSON__c** for the Intake Form Review Summary LWC.
