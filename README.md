# Intake Form Review Summary LWC

A reusable Salesforce Lightning Web Component that dynamically renders a review and summary view for intake forms. Designed for use in **OmniStudio OmniScripts** and **Record Pages**.

## Features

* **Dynamic Rendering**: Automatically processes nested objects and arrays from form data
* **Label\-Driven Display**: Only displays fields that have labels defined in `labelData` JSON
* **Order Preservation**: Renders sections, blocks, and fields in the exact order defined in `labelData`
* **Explicit Type Formatting**: Supports phone, email, currency, date, boolean, and number formatting
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

**Included POC OmniScript** (`POC_ReviewSummary_English_1`) demonstrates:

* DataRaptor Extract to fetch proposal data
* SetValues to define the `labelData` JSON mapping
* Custom LWC step using `intakeFormReviewSummary`

### On Record Pages (App Builder)

Configure via Lightning App Builder with these properties:

| Property | Type | Description |
|:---------|:-----|:------------|
| `formData` | JSON String | The form data to display |
| `labelData` | JSON String | Labels for fields (controls what's displayed) |
| `title` | String | Header title (default: "Review & Summary") |
| `hideEmptyFields` | Boolean | Hide fields with empty values |
| `collapsibleSections` | Boolean | Enable section collapse/expand |
| `skipFieldsList` | String | Comma\-separated field names to skip |

## Label Data Format

The `labelData` JSON controls which fields are displayed, their labels, and formatting.

### Basic Format (Auto\-detect Type)

```json
{
  "PersonalInfo_Step": {
    "_sectionTitle": "Personal Information",
    "firstName": "First Name",
    "lastName": "Last Name"
  }
}
```

### Advanced Format (Explicit Type)

Use object syntax to specify formatting type:

```json
{
  "PersonalInfo_Step": {
    "_sectionTitle": "Personal Information",
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

### Nested Blocks Example

```json
{
  "ApplicantInfo_Step": {
    "_sectionTitle": "Applicant Information",
    "ContactBlock": {
      "_blockTitle": "Contact Details",
      "name": "Full Name",
      "email": { "label": "Email", "type": "email" },
      "phone": { "label": "Phone", "type": "phone" },
      "AddressBlock": {
        "_blockTitle": "Mailing Address",
        "street": "Street",
        "city": "City",
        "state": "State",
        "zipCode": "Zip Code"
      }
    }
  }
}
```

### Key Points

* Only fields with labels in `labelData` are rendered
* Order follows `labelData` structure (not `formData`)
* Use `_sectionTitle` for section headers
* Use `_blockTitle` for nested block headers
* Supports nested objects and arrays
* Type is auto\-detected if not specified

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
