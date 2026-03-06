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

1. **Mirrors the exact structure** of the data JSON: same keys at every level. Section keys, block keys, and field keys in the label JSON must match the data JSON **exactly** (case-sensitive).
2. **Uses only the rules below** for how to represent sections, blocks, and fields.

---

### Structure rules

**Top level (sections)**  
- Each key is a section (e.g. a step or form section).  
- For each section provide:
  - **`_sectionTitle`** (string): Human-readable section title. Derive from the section key (e.g. turn `ApplicantInfo_Step` into "Applicant Information") or from context.
  - **`_order`** (number): Display order, starting at 1 and incrementing per section (1, 2, 3, …).
  - **All other keys** in that section are either **field keys** or **block keys** (see below). Do not add or remove keys; only add metadata (`_sectionTitle`, `_order`) and replace values with labels.

**Blocks (nested objects that are not primitives or arrays)**  
- If a value in the data JSON is an **object** (and not a single field with sub-fields like an address), treat it as a **block**.  
- For each block provide:
  - **`_blockTitle`** (string): Human-readable block title. Derive from the key (e.g. `ContactInfoBlock` → "Contact Information") or context.
  - **`_order`** (number): Order of the block within the section (1, 2, 3, …).
  - **All other keys** inside the block are field keys (see below). Again, preserve the same keys as in the data; only add metadata and labels.

**Fields (leaf values: strings, numbers, booleans, or values inside arrays)**  
- If the data value is a **primitive** (string, number, boolean) or is a **field inside a block/section**, define its **display label** in one of two ways:
  - **Short form:** A single string: the human-readable label (e.g. `"ApplicantInformation_CEOName": "CEO/Executive Director Name"`).
  - **Long form (when formatting or layout is needed):** An object:
    - **`label`** (string, required): Display label.
    - **`type`** (string, optional): One of: `phone`, `email`, `currency`, `date`, `boolean`, `number`. Use from value shape and naming:
      - Phone numbers (digits, or key/name contains "phone", "phoneNumber", "tel") → `phone`
      - Email-like strings or keys containing "email" → `email`
      - Money/amounts or keys like "budget", "amount", "salary", "grant" → `currency`
      - Date strings or keys like "date", "birthDate", "fiscalYearEnd" → `date`
      - true/false or keys like "isActive", "certify", "compliant" → `boolean`
      - Plain numbers (counts, EIN, etc.) → `number`
    - **`colspan`** (number, optional): Grid column span 1–12. Use 12 for long text/descriptions, 6 as default, 4 for short fields if you want a 3-column row.

**Arrays (repeatable blocks/lists)**  
- If a value in the data JSON is an **array of objects**, the label JSON does **not** repeat the array. Use **one** block with the **same key** as in the data. Inside that block, the keys are the **property names of the objects in the array**; each key gets a label (string or `{ "label": "...", "type": "..." }`).  
- Add **`_blockTitle`** and **`_order`** for that block so it renders as a titled, ordered block (e.g. "Outcomes", "Project Timeline").  
- Example: if data has `"PartnershipsCollaboration_OutcomesList": [ { "OutcomeDescriptions": "...", "TargetPop": 100 } ]`, the label JSON has one object `"PartnershipsCollaboration_OutcomesList": { "_blockTitle": "Outcomes", "_order": 1, "OutcomeDescriptions": "Outcome Description", "TargetPop": { "label": "Target Population Count", "type": "number" } }`.

**Keys to skip or treat as internal**  
- Do **not** create label entries for keys that are clearly internal or system-only (e.g. `recordId`, `Id`, `attributes`, or keys the user says to exclude).  
- Keys starting with **`_`** in the data (if any) are metadata; you can omit them from the label JSON or keep the same key and give a neutral label; the renderer typically skips `_` keys for display.

---

### Output requirements

- Output **only** valid JSON. No markdown code fences, no commentary before or after.
- Preserve the **exact key names** from the data JSON at every level (sections, blocks, fields). Only add `_sectionTitle`, `_order`, `_blockTitle`, and replace values with label strings or `{ "label", "type", "colspan" }` objects.
- Use the **long form** (`{ "label": "...", "type": "..." }`) for any field that should be formatted (phone, email, currency, date, boolean, number); use the **short form** (plain string) for plain text.
- Order sections and blocks with sequential `_order` (1, 2, 3, …) in the same order as they appear in the data JSON, unless the user specifies a different order.

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

* **Label Data Format** and **Special Properties Reference**: See [README.md](README.md#label-data-format) in this repo.
* **Custom Metadata**: Store the generated JSON in **Form_Review_Config__mdt** → **Label_JSON__c** for the Intake Form Review Summary LWC.
