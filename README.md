# Intake Form Review Summary LWC

A reusable Salesforce Lightning Web Component that dynamically renders a review and summary view for intake forms. Designed for use in **OmniStudio OmniScripts** and **Record Pages**.

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
├── lwc/
│   └── intakeFormReviewSummary/
│       ├── intakeFormReviewSummary.html
│       ├── intakeFormReviewSummary.js
│       ├── intakeFormReviewSummary.css
│       └── intakeFormReviewSummary.js-meta.xml
└── omniScripts/
    └── POC_ReviewSummary_English_1.os-meta.xml
```

## Usage

### In OmniStudio (OmniScript)

Add as a Custom LWC element. The component receives data via `omniJsonData`:

```json
{
  "formData": { ... },
  "labelData": { ... }
}
```

**Recommended Setup:**

1. Store `labelData` in Custom Metadata (`Form_Review_Config__mdt`)
2. Use DataRaptor to fetch label config
3. Use DataRaptor to fetch form data
4. Display in Custom LWC step

### On Record Pages (App Builder)

Configure via Lightning App Builder with these properties:

| Property | Type | Description |
|:---------|:-----|:------------|
| `formData` | JSON String | The form data to display |
| `labelData` | JSON String | Labels for fields (controls what's displayed) |
| `title` | String | Header title (optional) |
| `hideEmptyFields` | Boolean | Hide fields with empty values |
| `collapsibleSections` | Boolean | Enable section collapse/expand |
| `skipFieldsList` | String | Comma\-separated field names to skip |

## Label Data Format

The `labelData` JSON controls which fields are displayed, their labels, ordering, and formatting.

### Basic Format

```json
{
  "PersonalInfo_Step": {
    "_sectionTitle": "Personal Information",
    "_order": 1,
    "firstName": "First Name",
    "lastName": "Last Name"
  }
}
```

### Advanced Format (Explicit Type & Order)

```json
{
  "PersonalInfo_Step": {
    "_sectionTitle": "Personal Information",
    "_order": 1,
    "phone": { "label": "Phone Number", "type": "phone" },
    "email": { "label": "Email Address", "type": "email" },
    "salary": { "label": "Annual Salary", "type": "currency" },
    "birthDate": { "label": "Date of Birth", "type": "date" },
    "isActive": { "label": "Is Active?", "type": "boolean" },
    "count": { "label": "Total Count", "type": "number" }
  }
}
```

### Supported Types & Formatting

| Type | Input | Output |
|:-----|:------|:-------|
| `phone` | `8745638765` | `(874) 563-8765` |
| `email` | `John@Example.COM` | `john@example.com` |
| `currency` | `15000` | `$15,000.00` |
| `date` | `2026-12-31` | `December 31, 2026` |
| `boolean` | `true` | `Yes` |
| `number` | `1000` | `1,000` |

### Section Ordering

Use `_order` property to control display sequence (required when using DataRaptor):

```json
{
  "Section_A": { "_sectionTitle": "First Section", "_order": 1 },
  "Section_B": { "_sectionTitle": "Second Section", "_order": 2 },
  "Section_C": { "_sectionTitle": "Third Section", "_order": 3 }
}
```

### Nested Blocks Example

```json
{
  "ApplicantInfo_Step": {
    "_sectionTitle": "Applicant Information",
    "_order": 1,
    "ContactBlock": {
      "_blockTitle": "Contact Details",
      "_order": 1,
      "name": "Full Name",
      "email": { "label": "Email", "type": "email" },
      "phone": { "label": "Phone", "type": "phone" }
    }
  }
}
```

### Special Properties

| Property | Level | Description |
|:---------|:------|:------------|
| `_sectionTitle` | Section | Display title for section header |
| `_blockTitle` | Block | Display title for block header |
| `_order` | Section/Block | Sort order (ascending, lower = first) |

## Custom Metadata Setup

Store label configurations in Custom Metadata for maintainability.

### Custom Metadata Type

**API Name:** `Form_Review_Config__mdt`

| Field | API Name | Type | Description |
|:------|:---------|:-----|:------------|
| Label JSON | `Label_JSON__c` | Long Text Area (131072) | The labelData JSON |
| Form Type | `Form_Type__c` | Text (255) | Identifier for the form type |
| Is Active | `Is_Active__c` | Checkbox | Enable/disable config |
| Description | `Description__c` | Text Area (1000) | Documentation |

### DataRaptor Extract

Create a DataRaptor to fetch the label config:

| Object | Field | Output Path |
|:-------|:------|:------------|
| `Form_Review_Config__mdt` | `Label_JSON__c` | `labelData` |

**Filter:** `DeveloperName = :configName AND Is_Active__c = true`

### OmniScript Flow

```
SetValues (configDeveloperName = "Your_Config_Name")
    ↓
DataRaptor Extract (fetch labelData from Custom Metadata)
    ↓
DataRaptor Extract (fetch formData)
    ↓
Custom LWC Step (intakeFormReviewSummary)
```

## Development

### Prerequisites

* Salesforce CLI (`sf` or `sfdx`)
* Node.js (for local development)
* VS Code with Salesforce Extension Pack (recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/Rdevang/Review-Summary-LWC.git
cd Review-Summary-LWC

# Install dependencies
npm install

# Authenticate to your org
sf org login web -a MyOrg

# Deploy to org
sf project deploy start -o MyOrg
```

### Local Development

```bash
# Run linting
npm run lint

# Run tests
npm run test
```

## Deployment

### Deploy to Org

```bash
# Deploy using manifest
sf project deploy start -x manifest/package.xml -o <org-alias>

# Deploy specific component
sf project deploy start -p force-app/main/default/lwc/intakeFormReviewSummary -o <org-alias>
```

### Retrieve from Org

```bash
sf project retrieve start -x manifest/package.xml -o <org-alias>
```

## API Version

* Salesforce API Version: **65.0**

## License

MIT License \- See [LICENSE](LICENSE) for details.
