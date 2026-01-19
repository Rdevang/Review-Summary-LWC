# Intake Form Review Summary LWC

A reusable Salesforce Lightning Web Component that dynamically renders a review and summary view for intake forms. Designed for use in **OmniStudio OmniScripts** and **Record Pages**.

## Features

* **Dynamic Rendering**: Automatically processes nested objects and arrays from form data
* **Label\-Driven Display**: Only displays fields that have labels defined in `labelData` JSON
* **Dual Context Support**: Works both as OmniStudio Custom LWC and standalone on Record Pages
* **Collapsible Sections**: Expandable/collapsible sections with keyboard accessibility
* **Smart Field Detection**: Auto\-detects field types (email, phone, currency, date, boolean)
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

The `labelData` JSON controls which fields are displayed and their labels:

```json
{
  "PersonalInfo_Step": {
    "_sectionTitle": "Personal Information",
    "firstName": "First Name",
    "lastName": "Last Name",
    "contactBlock": {
      "_blockTitle": "Contact Details",
      "email": "Email Address",
      "phone": "Phone Number"
    }
  }
}
```

### Key Points

* Only fields with labels in `labelData` are rendered
* Use `_sectionTitle` for section headers
* Use `_blockTitle` for nested block headers
* Supports nested objects and arrays

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
