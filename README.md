# Intake Form Review Summary LWC

A reusable Salesforce Lightning Web Component that dynamically renders a review and summary view for intake forms. Designed for use in **OmniStudio OmniScripts** and **Record Pages**.

## Table of Contents

* [Features](#features)
* [Project Structure](#project-structure)
* [Quick Start](#quick-start)
* [Step\-by\-Step Setup Guide](#step-by-step-setup-guide)
* [Label Data Format](#label-data-format)
* [API Reference](#api-reference)
* [Deployment](#deployment)
* [Troubleshooting](#troubleshooting)

## Features

* **Dynamic Rendering**: Automatically processes nested objects and arrays from form data
* **Label\-Driven Display**: Only displays fields that have labels defined in `labelData` JSON
* **Explicit Ordering**: Use `_order` property to control section/block display order
* **Explicit Type Formatting**: Supports phone, email, currency, date, boolean, and number formatting
* **Custom Metadata Support**: Store label configs in Custom Metadata for easy maintenance
* **Dual Context Support**: Works both as OmniStudio Custom LWC and standalone on Record Pages
* **Collapsible Sections**: Expandable/collapsible sections with keyboard accessibility
* **Array Tables**: Renders repeatable blocks as accessible data tables
* **WCAG 2.1 AA Compliant**: Built with accessibility standards in mind

## Project Structure

```
force-app/main/default/
├── customMetadata/
│   └── Form_Review_Config.MAEOED_Proposal_Config.md-meta.xml
├── lwc/
│   └── intakeFormReviewSummary/
│       ├── intakeFormReviewSummary.html
│       ├── intakeFormReviewSummary.js
│       ├── intakeFormReviewSummary.css
│       └── intakeFormReviewSummary.js-meta.xml
├── objects/
│   └── Form_Review_Config__mdt/
│       ├── Form_Review_Config__mdt.object-meta.xml
│       └── fields/
│           ├── Label_JSON__c.field-meta.xml
│           ├── Form_Type__c.field-meta.xml
│           ├── Is_Active__c.field-meta.xml
│           └── Description__c.field-meta.xml
├── omniDataTransforms/
│   ├── DRExtractLabelJSON_1.rpt-meta.xml
│   └── DRExtractMAEOEDProposalData_1.rpt-meta.xml
└── omniScripts/
    └── POC_ReviewSummary_English_1.os-meta.xml
```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Rdevang/Review-Summary-LWC.git
cd Review-Summary-LWC

# 2. Authenticate to your Salesforce org
sf org login web -a MyOrg

# 3. Deploy everything
sf project deploy start -x manifest/package.xml -o MyOrg
```

---

## Step\-by\-Step Setup Guide

### Step 1: Deploy the LWC Component

Deploy the Lightning Web Component to your org:

```bash
sf project deploy start -p force-app/main/default/lwc/intakeFormReviewSummary -o <org-alias>
```

### Step 2: Create Custom Metadata Type

Create `Form_Review_Config__mdt` to store label configurations.

**Option A: Deploy from this repo**

```bash
sf project deploy start -p force-app/main/default/objects/Form_Review_Config__mdt -o <org-alias>
```

**Option B: Create manually in Setup**

1. Go to **Setup** → **Custom Metadata Types** → **New Custom Metadata Type**
2. Enter:
   * Label: `Form Review Config`
   * Plural Label: `Form Review Configs`
   * Object Name: `Form_Review_Config`
3. Click **Save**
4. Add these custom fields:

| Field Label | API Name | Type | Length |
|:------------|:---------|:-----|:-------|
| Label JSON | `Label_JSON__c` | Long Text Area | 131072 |
| Form Type | `Form_Type__c` | Text | 255 |
| Is Active | `Is_Active__c` | Checkbox | — |
| Description | `Description__c` | Text Area | 1000 |

### Step 3: Create a Custom Metadata Record

1. Go to **Setup** → **Custom Metadata Types** → **Form Review Config** → **Manage Records**
2. Click **New**
3. Fill in:
   * **Label**: `MAEOED Proposal Config`
   * **Name**: `MAEOED_Proposal_Config`
   * **Form Type**: `MAEOED_Proposal`
   * **Is Active**: ✅ Checked
   * **Label JSON**: *(paste your labelData JSON \- see format below)*
4. Click **Save**

### Step 4: Create DataRaptor to Fetch Label Config

Create a DataRaptor Extract named `DRExtractLabelJSON`:

1. Go to **OmniStudio** → **DataRaptors** → **New**
2. Configure:
   * **Name**: `DRExtractLabelJSON`
   * **Interface Type**: Extract
   * **Input/Output Type**: JSON

**EXTRACT Tab:**

| Extract Object | Extract Field | Output Path |
|:---------------|:--------------|:------------|
| `Form_Review_Config__mdt` | `Label_JSON__c` | `labelData` |

**Filter:**

| Field | Operator | Value |
|:------|:---------|:------|
| `DeveloperName` | Equals | `:configDeveloperName` |
| `Is_Active__c` | Equals | `true` |

**OPTIONS Tab (Recommended for Performance):**

| Setting | Value |
|:--------|:------|
| Time To Live In Minutes | `1440` |
| Salesforce Platform Cache Type | Org Cache |

### Step 5: Create DataRaptor to Fetch Form Data

Create a DataRaptor Extract for your form data (e.g., `DRExtractMAEOEDProposalData`):

1. Configure extraction from your source object (e.g., Proposal, Application, etc.)
2. Map fields to output JSON structure that matches your labelData keys

### Step 6: Create OmniScript

Create an OmniScript to tie everything together:

1. Go to **OmniStudio** → **OmniScripts** → **New**
2. Configure:
   * **Type**: Your type (e.g., `POC`)
   * **SubType**: `ReviewSummary`
   * **Language**: English

**Add Elements in This Order:**

#### 6.1 SetValues Element

**Name**: `SetValues`

**Element Value Map**:

```json
{
  "configDeveloperName": "MAEOED_Proposal_Config",
  "proposalID": "=IF(%isPortalUser%, %proposal%, %ContextId%)",
  "isPortalUser": "=%userProfile% != \"System Administrator\""
}
```

#### 6.2 DataRaptor Extract \- Label Config

**Name**: `DRExtractLabelJSON`

**DataRaptor Interface**: `DRExtractLabelJSON`

**Input Parameters**:

| Key | Value |
|:----|:------|
| `configDeveloperName` | `%configDeveloperName%` |

#### 6.3 DataRaptor Extract \- Form Data

**Name**: `DRExtractDataJSON`

**DataRaptor Interface**: `DRExtractMAEOEDProposalData`

**Input Parameters**:

| Key | Value |
|:----|:------|
| `propID` | `%proposalID%` |

#### 6.4 Step with Custom LWC

**Name**: `ReviewSummary`

**Step Label**: `Review & Summary`

**Add Custom Lightning Web Component:**

* **LWC Name**: `intakeFormReviewSummary`

### Step 7: Activate and Test

1. Click **Activate** on the OmniScript
2. Click **Preview** to test
3. Verify sections display in correct order with proper formatting

---

## Label Data Format

The `labelData` JSON controls which fields are displayed, their labels, ordering, and formatting.

### Basic Structure

```json
{
  "SectionKey_Step": {
    "_sectionTitle": "Section Display Title",
    "_order": 1,
    "fieldName": "Field Label",
    "anotherField": "Another Label"
  }
}
```

### With Explicit Type Formatting

```json
{
  "PersonalInfo_Step": {
    "_sectionTitle": "Personal Information",
    "_order": 1,
    "firstName": "First Name",
    "lastName": "Last Name",
    "phone": { "label": "Phone Number", "type": "phone" },
    "email": { "label": "Email Address", "type": "email" },
    "salary": { "label": "Annual Salary", "type": "currency" },
    "birthDate": { "label": "Date of Birth", "type": "date" },
    "isActive": { "label": "Is Active?", "type": "boolean" }
  }
}
```

### With Nested Blocks

```json
{
  "ApplicantInfo_Step": {
    "_sectionTitle": "Applicant Information",
    "_order": 1,
    "OrganizationBlock": {
      "_blockTitle": "Organization Details",
      "_order": 1,
      "orgName": "Organization Name",
      "budget": { "label": "Annual Budget", "type": "currency" }
    },
    "ContactBlock": {
      "_blockTitle": "Contact Person",
      "_order": 2,
      "contactName": "Contact Name",
      "contactEmail": { "label": "Email", "type": "email" },
      "contactPhone": { "label": "Phone", "type": "phone" }
    }
  }
}
```

### Supported Types & Formatting

| Type | Input Example | Output Example |
|:-----|:--------------|:---------------|
| `phone` | `8745638765` | `(874) 563-8765` |
| `email` | `John@Example.COM` | `john@example.com` |
| `currency` | `15000` | `$15,000.00` |
| `date` | `2026-12-31` | `December 31, 2026` |
| `boolean` | `true` | `Yes` |
| `number` | `1000` | `1,000` |

### Special Properties Reference

| Property | Level | Required | Description |
|:---------|:------|:---------|:------------|
| `_sectionTitle` | Section | Yes | Display title for section header |
| `_blockTitle` | Block | Yes | Display title for block header |
| `_order` | Section/Block | Recommended | Sort order (ascending, 1 = first) |
| `label` | Field | Yes (if object) | Display label when using type |
| `type` | Field | No | Format type: phone, email, currency, date, boolean, number |

---

## API Reference

### Component Properties

| Property | Type | Default | Description |
|:---------|:-----|:--------|:------------|
| `omniJsonData` | Object | — | Auto\-populated by OmniScript |
| `formData` | String/Object | — | Form data JSON (for Record Pages) |
| `labelData` | String/Object | — | Label configuration JSON |
| `title` | String | `""` | Optional header title |
| `hideEmptyFields` | Boolean | `false` | Hide fields with empty values |
| `collapsibleSections` | Boolean | `false` | Enable collapse/expand |
| `skipFieldsList` | String | `""` | Comma\-separated fields to skip |

### OmniScript Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      OmniScript                          │
├─────────────────────────────────────────────────────────┤
│  1. SetValues                                            │
│     └── configDeveloperName = "Your_Config_Name"        │
│                                                          │
│  2. DataRaptor Extract (Label Config)                   │
│     └── Output: labelData (JSON string)                 │
│                                                          │
│  3. DataRaptor Extract (Form Data)                      │
│     └── Output: form data nodes                          │
│                                                          │
│  4. Custom LWC Step                                      │
│     └── intakeFormReviewSummary                          │
│         └── Receives omniJsonData with:                 │
│             ├── labelData                                │
│             └── form data                                │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment

### Deploy All Components

```bash
sf project deploy start -x manifest/package.xml -o <org-alias>
```

### Deploy Individual Components

```bash
# LWC only
sf project deploy start -p force-app/main/default/lwc/intakeFormReviewSummary -o <org-alias>

# Custom Metadata Type
sf project deploy start -p force-app/main/default/objects/Form_Review_Config__mdt -o <org-alias>

# Custom Metadata Records
sf project deploy start -p force-app/main/default/customMetadata -o <org-alias>

# OmniScript
sf project deploy start -p force-app/main/default/omniScripts -o <org-alias>

# DataRaptors
sf project deploy start -p force-app/main/default/omniDataTransforms -o <org-alias>
```

### Retrieve from Org

```bash
sf project retrieve start -x manifest/package.xml -o <org-alias>
```

---

## Troubleshooting

### Sections Display in Wrong Order

**Cause**: DataRaptor can reverse JSON key order.

**Solution**: Add `_order` property to each section in labelData:

```json
{
  "Section_A": { "_sectionTitle": "First", "_order": 1 },
  "Section_B": { "_sectionTitle": "Second", "_order": 2 }
}
```

### Component Shows Loading Forever in OmniScript Preview

**Cause**: `omniJsonData` not available when component initializes.

**Solution**: Ensure you're using the latest LWC version which handles delayed data arrival.

### Fields Not Displaying

**Cause**: Field key in formData doesn't match labelData.

**Solution**: Verify exact key names match between formData and labelData:

```json
// formData
{ "ApplicantInformation_CEOEmail": "test@example.com" }

// labelData (key must match exactly)
{ "ApplicantInformation_CEOEmail": "CEO Email" }
```

### Phone/Currency/Date Not Formatting

**Cause**: Type not specified explicitly.

**Solution**: Use object format with type:

```json
{
  "phone": { "label": "Phone", "type": "phone" },
  "amount": { "label": "Amount", "type": "currency" }
}
```

---

## API Version

* Salesforce API Version: **65.0**

## License

MIT License \- See [LICENSE](LICENSE) for details.
