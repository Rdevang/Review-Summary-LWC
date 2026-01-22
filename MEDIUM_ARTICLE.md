# Building a Reusable Review Summary Component for Salesforce OmniStudio

*A complete guide to creating a dynamic, configuration-driven LWC that displays form data beautifully — with detailed explanations of every architectural decision*

---

## Introduction

If you're a Salesforce developer working with OmniStudio, you've likely built multi-step intake forms, grant applications, or onboarding wizards. And at the end of every form, you need a Review Summary — a page where users can see everything they've entered before hitting "Submit."

This tutorial will teach you how to build a single, reusable component that works for any form without code changes.

### What You'll Build

```
┌────────────────────────────────────────────────────────────────────┐
│  Review Summary                                                     │
├────────────────────────────────────────────────────────────────────┤
│ ▼ Eligibility Information                                          │
│   ┌─────────────────────────┐  ┌─────────────────────────┐        │
│   │ Non-Profit Status       │  │ EIN Number              │        │
│   │ Yes                     │  │ 12-3456789              │        │
│   └─────────────────────────┘  └─────────────────────────┘        │
│   ┌─────────────────────────────────────────────────────┐         │
│   │ Annual Operating Budget                              │         │
│   │ $500,000.00                                          │         │
│   └─────────────────────────────────────────────────────┘         │
│                                                                    │
│ ▼ Applicant Information                                            │
│   ┌─ Organization Details ──────────────────────────────┐         │
│   │ Organization Name                                    │         │
│   │ Community Health Initiative                          │         │
│   │                                                      │         │
│   │ Annual Budget         │ Year Established             │         │
│   │ $750,000.00          │ 2015                         │         │
│   └──────────────────────────────────────────────────────┘        │
│   ┌─ CEO Information ───────────────────────────────────┐         │
│   │ CEO Name              │ CEO Email                    │         │
│   │ Jane Smith            │ jane@example.org             │         │
│   │                       │                              │         │
│   │ CEO Phone                                            │         │
│   │ (555) 123-4567                                       │         │
│   └──────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────┘
```

Key Features:
- ✅ Collapsible sections
- ✅ Automatic currency formatting ($500,000.00)
- ✅ Phone number formatting ((555) 123-4567)
- ✅ Responsive 12-column grid layout
- ✅ Nested blocks support
- ✅ Works in OmniScript AND Record Pages

---

### What You'll Learn

| Section | What You'll Learn | Time |
|---------|-------------------|------|
| Architecture | Why this design scales | 5 min |
| Step-by-Step Guide | Complete setup instructions | 20 min |
| Deep Dive | Code explanations with reasoning | 15 min |
| Troubleshooting | Common issues and fixes | 5 min |

Prerequisites:
- Basic knowledge of Lightning Web Components (LWC)
- Familiarity with Salesforce OmniStudio (OmniScripts, DataRaptors)
- Understanding of Custom Metadata Types

Full Source Code: [github.com/Rdevang/Review-Summary-LWC](https://github.com/Rdevang/Review-Summary-LWC)

> 💡 New to OmniStudio? Don't worry — the step-by-step guide explains every click. Just follow along!

---

## The Problem: Why This Matters

### The Naive Approach (And Why It Fails)

When developers first encounter this requirement, they typically do one of these:

Approach 1: Hardcode Everything
```javascript
// ❌ DON'T DO THIS
get applicantName() {
    return this.formData.Step1_ApplicantInfo.firstName + ' ' + 
           this.formData.Step1_ApplicantInfo.lastName;
}
get organizationBudget() {
    return '$' + this.formData.Step2_OrgDetails.annualBudget;
}
// ... 50 more getters
```

Problems:
- Every new form requires a new component
- Field name changes break the component
- No reusability whatsoever
- Maintenance nightmare at scale

Approach 2: Use OmniScript's Built-in Summary

OmniStudio has a Summary element, but it:
- Has limited styling options
- Doesn't support custom formatting
- Can't handle complex nested data well
- Looks generic and unprofessional

Approach 3: Build a Generic Component (What We'll Do)

The solution is a component that:
- Takes data (what to display) and configuration (how to display it)
- Requires zero code changes for new forms
- Handles any nested structure dynamically
- Formats data intelligently (phone, email, currency, dates)

---

## Architecture: The Big Picture

Before writing code, let's understand the architecture. This is crucial — good architecture makes everything else easier.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OmniScript                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Step 1:    │───▶│   Step 2:    │───▶│   Step 3:    │          │
│  │ Eligibility  │    │  Applicant   │    │   Review     │          │
│  │    Form      │    │    Info      │    │   Summary    │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                  │                   │
│                                    ┌─────────────▼─────────────┐    │
│                                    │  intakeFormReviewSummary  │    │
│                                    │         (LWC)             │    │
│                                    └─────────────┬─────────────┘    │
│                                                  │                   │
│                           ┌──────────────────────┴──────────────┐   │
│                           ▼                                      ▼   │
│                    ┌─────────────┐                     ┌───────────┐│
│                    │  formData   │                     │ labelData ││
│                    │ (from steps │                     │ (Custom   ││
│                    │  or object) │                     │ Metadata) ││
│                    └─────────────┘                     └───────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

Separation of Concerns:
| Component | Responsibility | Can Change Without Affecting Others? |
|-----------|---------------|--------------------------------------|
| LWC | Rendering logic | ✅ Yes - styling, layout changes |
| labelData | Display configuration | ✅ Yes - labels, order, formatting |
| formData | Actual user input | ✅ Yes - field additions/removals |

The Key Insight: By separating what to display (formData) from how to display it (labelData), we achieve true reusability.

---

## Step-by-Step Implementation Guide

This section provides a complete walkthrough for implementing the Review Summary component. Follow these steps in order.

### Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Salesforce CLI installed ([Install Guide](https://developer.salesforce.com/tools/sfdxcli))
- [ ] VS Code with Salesforce Extension Pack
- [ ] OmniStudio enabled in your org
- [ ] DevHub or Scratch Org access (for development)
- [ ] Git installed (optional, for cloning repo)

Verify Salesforce CLI:
```bash
sf --version
# Should output: @salesforce/cli/2.x.x
```

---

### Step 1: Get the Source Code

Option A: Clone from GitHub (Recommended)
```bash
# Clone the repository
git clone https://github.com/Rdevang/Review-Summary-LWC.git

# Navigate to the project
cd Review-Summary-LWC
```

Option B: Download ZIP
1. Go to [github.com/Rdevang/Review-Summary-LWC](https://github.com/Rdevang/Review-Summary-LWC)
2. Click Code → Download ZIP
3. Extract to your workspace

---

### Step 2: Authorize Your Salesforce Org

```bash
# For Production/Developer org
sf org login web --alias my-org

# For Sandbox
sf org login web --alias my-sandbox --instance-url https://test.salesforce.com

# Verify connection
sf org list
```

Why authorize first? Deployment requires an authenticated connection to your target org.

---

### Step 3: Deploy the LWC Component

```bash
# Deploy only the LWC
sf project deploy start \
  --source-dir force-app/main/default/lwc/intakeFormReviewSummary \
  --target-org my-org

# Verify deployment
sf project deploy report
```

Expected output:
```
Deployed Source
  TYPE                    NAME                      
  ─────────────────────── ─────────────────────────
  LightningComponentBundle intakeFormReviewSummary
```

---

### Step 4: Create the Custom Metadata Type

In Salesforce Setup:

1. Go to Setup → Custom Metadata Types
2. Click New Custom Metadata Type
3. Fill in:
   - Label: `Form Review Config`
   - Object Name: `Form_Review_Config`
   - Description: `Stores label configuration JSON for review summary component`
4. Click Save

Add Custom Fields:

| Field Label | API Name | Type | Length |
|-------------|----------|------|--------|
| Form Type | Form_Type__c | Text | 100 |
| Label JSON | Label_JSON__c | Long Text Area | 131072 |
| Is Active | Is_Active__c | Checkbox | — |
| Description | Description__c | Text Area | 1000 |

Why Long Text Area with 131,072 characters?
- Complex forms can have hundreds of fields
- Nested JSON structures consume characters quickly
- This is the maximum allowed size

---

### Step 5: Create Your Label Configuration Record

In Salesforce Setup:

1. Go to Setup → Custom Metadata Types
2. Click Form Review Config → Manage Records
3. Click New
4. Fill in:
   - Label: `My Form Config`
   - Name: `My_Form_Config`
   - Form Type: `My Application Form`
   - Is Active: ✅ Checked
   - Label JSON: (see below)

Sample Label JSON:

```json
{
  "Step1_PersonalInfo": {
    "_sectionTitle": "Personal Information",
    "_order": 1,
    "firstName": { "label": "First Name", "colspan": 6 },
    "lastName": { "label": "Last Name", "colspan": 6 },
    "email": { "label": "Email Address", "type": "email", "colspan": 6 },
    "phone": { "label": "Phone Number", "type": "phone", "colspan": 6 },
    "dateOfBirth": { "label": "Date of Birth", "type": "date", "colspan": 6 }
  },
  "Step2_Employment": {
    "_sectionTitle": "Employment Details",
    "_order": 2,
    "employerName": { "label": "Employer Name", "colspan": 12 },
    "annualSalary": { "label": "Annual Salary", "type": "currency", "colspan": 6 },
    "startDate": { "label": "Start Date", "type": "date", "colspan": 6 }
  }
}
```

Critical: The keys (like `Step1_PersonalInfo`, `firstName`) must exactly match your OmniScript field names. Case matters!

---

### How to Find Your Exact Field Names

This is the most important step. Your labelData keys must match your OmniScript data exactly.

Method 1: Use OmniScript Preview Console

1. Open your OmniScript in Preview mode
2. Fill out some test data in the form
3. Open browser DevTools (F12 or Cmd+Option+I)
4. Go to Console tab
5. Type: `JSON.stringify(omniJsonData, null, 2)`
6. Press Enter

You'll see your exact data structure:

```json
{
  "Step1_PersonalInfo": {           // ← This is your section key
    "firstName": "John",            // ← This is your field key
    "lastName": "Doe",
    "ContactBlock": {               // ← This is a block key
      "email": "john@example.com",
      "phone": "5551234567"
    }
  },
  "Step2_Employment": {
    "employerName": "Acme Inc",
    "annualSalary": 75000
  }
}
```

Method 2: Check OmniScript Designer

1. Open your OmniScript in Designer
2. Click on each Step → note the Name property
3. Click on each Field → note the Field API Name
4. Click on each Block → note the Name property

Create labelData to match:

```json
{
  "Step1_PersonalInfo": {           // Must match Step name
    "_sectionTitle": "Personal Information",
    "_order": 1,
    "firstName": "First Name",      // Must match Field API Name
    "lastName": "Last Name",
    "ContactBlock": {               // Must match Block name
      "_blockTitle": "Contact Details",
      "email": { "label": "Email", "type": "email" },
      "phone": { "label": "Phone", "type": "phone" }
    }
  },
  "Step2_Employment": {             // Must match Step name
    "_sectionTitle": "Employment",
    "_order": 2,
    "employerName": "Employer Name",
    "annualSalary": { "label": "Annual Salary", "type": "currency" }
  }
}
```

Common Naming Patterns in OmniStudio:

| OmniScript Element | Typical Name Pattern | Example |
|--------------------|--------------------|---------|
| Step | `StepName_Step` or `Step1_Name` | `Eligibility_Step` |
| Text Field | `StepName_FieldName` | `Eligibility_FirstName` |
| Block | `StepName_BlockName_Block` | `Applicant_Address_Block` |
| Nested Block | `ParentBlock_ChildName-Block` | `Contact_Address-Block` |

---

### Step 6: Create the DataRaptor for Label Configuration

In OmniStudio:

1. Go to OmniStudio → DataRaptors
2. Click New → Extract
3. Fill in:
   - Name: `DRExtractLabelJSON`
   - Interface Name: `DRExtractLabelJSON`

Configure the DataRaptor:

Tab: Extract
| Object | Fields |
|--------|--------|
| Form_Review_Config__mdt | DeveloperName, Label_JSON__c, Is_Active__c |

Tab: Output
| Extract JSON Path | Output JSON Path |
|-------------------|------------------|
| Form_Review_Config__mdt:Label_JSON__c | labelData |

Tab: Filter
```
DeveloperName = :configDeveloperName
Is_Active__c = true
```

Tab: Options
- Enable Use Platform Cache for performance
- Set Cache TTL: 60 minutes

4. Click Save & Activate

---

### Step 7: Create the DataRaptor for Form Data

This DataRaptor fetches the actual form data from your Salesforce object.

In OmniStudio:

1. Go to OmniStudio → DataRaptors
2. Click New → Extract
3. Fill in:
   - Name: `DRExtractFormData`
   - Interface Name: `DRExtractFormData`

Configure based on your data model:

Example: Data stored in Long Text Area fields
| Extract JSON Path | Output JSON Path |
|-------------------|------------------|
| Application__c:Step1_Data__c | Step1_PersonalInfo |
| Application__c:Step2_Data__c | Step2_Employment |

Filter:
```
Id = :recordId
```

4. Click Save & Activate

---

### Step 8: Configure Your OmniScript

Create or open your OmniScript in Designer:

8.1 Add SetValues Element (at the start)

| Property | Value |
|----------|-------|
| Name | SetValues |
| Element Type | Set Values |

Element Value JSON:
```json
{
  "configDeveloperName": "My_Form_Config",
  "recordId": "=IF(%isPortalUser%, %recordId%, %ContextId%)",
  "isPortalUser": "=%userProfile% != \"System Administrator\""
}
```

8.2 Add DataRaptor Extract for Labels

| Property | Value |
|----------|-------|
| Name | DRGetLabelConfig |
| Element Type | DataRaptor Extract Action |
| DataRaptor Interface | DRExtractLabelJSON |

Input Parameters:
| Key | Value |
|-----|-------|
| configDeveloperName | %configDeveloperName% |

8.3 Add DataRaptor Extract for Form Data

| Property | Value |
|----------|-------|
| Name | DRGetFormData |
| Element Type | DataRaptor Extract Action |
| DataRaptor Interface | DRExtractFormData |

Input Parameters:
| Key | Value |
|-----|-------|
| recordId | %recordId% |

8.4 Add the Review Summary Step

1. Add a new Step element
   - Name: `ReviewSummary_Step`
   - Label: `Review Summary`

2. Inside the step, add Custom Lightning Web Component
   - LWC Component Name: `c-intake-form-review-summary`
   - The component automatically receives all OmniScript data via `omniJsonData`

---

### Step 9: Test Your Implementation

9.1 Test in OmniScript Preview

1. In OmniScript Designer, click Preview
2. If using a record, add URL parameter: `?ContextId=<your-record-id>`
3. Navigate through your form steps
4. The Review Summary should display your data

9.2 Debug if Needed

Open browser DevTools (F12) → Console tab:

```javascript
// Look for these logs
"IntakeFormReviewSummary - omniJsonData:"  // Shows all data
"IntakeFormReviewSummary - _formData keys:" // Shows form structure
"IntakeFormReviewSummary - _labelData keys:" // Shows label config
```

Common issues:
- Keys don't match → Update labelData JSON
- Data shows as `[object Object]` → JSON needs parsing
- Sections wrong order → Add `_order` property

9.3 Test on Record Page

1. Go to a record of your object
2. Launch the OmniScript
3. Verify data displays correctly

---

### Step 10: Deploy Everything

Once tested, deploy all components:

```bash
# Deploy everything in package.xml
sf project deploy start \
  --manifest manifest/package.xml \
  --target-org my-org

# Or deploy to production with tests
sf project deploy start \
  --manifest manifest/package.xml \
  --target-org production-org \
  --test-level RunLocalTests
```

---

### Quick Reference: File Locations

| Component | Path |
|-----------|------|
| LWC | `force-app/main/default/lwc/intakeFormReviewSummary/` |
| Custom Metadata Type | `force-app/main/default/objects/Form_Review_Config__mdt/` |
| Metadata Records | `force-app/main/default/customMetadata/` |
| DataRaptors | `force-app/main/default/omniDataTransforms/` |
| OmniScript | `force-app/main/default/omniScripts/` |
| Package Manifest | `manifest/package.xml` |

---

### Adding a New Form (Future)

Once set up, adding support for a new form is simple:

1. Create new Custom Metadata record with the labelData JSON
2. Update SetValues in OmniScript: `"configDeveloperName": "New_Form_Config"`
3. No code changes required!

This is the power of configuration-driven development.

---

### Complete Data Flow Diagram

Here's how all the pieces work together at runtime:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RUNTIME DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

User fills out OmniScript
         │
         ▼
┌─────────────────────┐
│   OmniScript        │
│   Step 1, 2, 3...   │ ──── User enters data in form fields
└─────────────────────┘
         │
         ▼ User clicks "Next" to Review step
         │
┌─────────────────────────────────────────────────────────────────────────┐
│                        REVIEW SUMMARY STEP                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐      ┌──────────────────┐                        │
│  │ SetValues        │      │ configDeveloperName = "My_Form_Config"    │
│  │ (runs first)     │ ───► │ recordId = "001xx..."                     │
│  └──────────────────┘      └──────────────────┘                        │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐      ┌──────────────────┐                        │
│  │ DataRaptor       │      │ Fetches from:                             │
│  │ (Label Config)   │ ───► │ Form_Review_Config__mdt                   │
│  └──────────────────┘      │ WHERE Name = "My_Form_Config"             │
│           │                └──────────────────┘                        │
│           │                         │                                   │
│           │                         ▼                                   │
│           │                ┌──────────────────┐                        │
│           │                │ labelData JSON   │                        │
│           │                │ (field labels,   │                        │
│           │                │  types, order)   │                        │
│           │                └──────────────────┘                        │
│           │                         │                                   │
│           ▼                         │                                   │
│  ┌──────────────────┐               │                                   │
│  │ DataRaptor       │               │                                   │
│  │ (Form Data)      │ (optional - if data stored in object)            │
│  └──────────────────┘               │                                   │
│           │                         │                                   │
│           ▼                         ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                 omniJsonData                                 │       │
│  │  {                                                           │       │
│  │    "Step1_PersonalInfo": { "firstName": "John", ... },      │       │
│  │    "Step2_Employment": { "salary": 75000, ... },            │       │
│  │    "labelData": { "_sectionTitle": "...", "firstName": ...} │       │
│  │  }                                                           │       │
│  └─────────────────────────────────────────────────────────────┘       │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │           intakeFormReviewSummary (LWC)                      │       │
│  │                                                               │       │
│  │  1. Receives omniJsonData                                    │       │
│  │  2. Extracts formData (steps) and labelData                  │       │
│  │  3. Iterates over labelData keys (for order)                 │       │
│  │  4. Matches with formData values                             │       │
│  │  5. Formats values (phone, currency, date)                   │       │
│  │  6. Renders UI with 12-column grid                           │       │
│  └─────────────────────────────────────────────────────────────┘       │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    RENDERED OUTPUT                           │       │
│  │  ┌─────────────────────────────────────────┐                │       │
│  │  │ ▼ Personal Information                  │                │       │
│  │  │   First Name: John    Last Name: Doe    │                │       │
│  │  │   Phone: (555) 123-4567                 │                │       │
│  │  │ ▼ Employment                            │                │       │
│  │  │   Salary: $75,000.00                    │                │       │
│  │  └─────────────────────────────────────────┘                │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Implementation Checklist

Use this checklist to verify your setup:

Deployment:
- [ ] LWC deployed to org
- [ ] Custom Metadata Type created with all fields
- [ ] Custom Metadata record created with labelData JSON

DataRaptors:
- [ ] Label Config DataRaptor created and activated
- [ ] Form Data DataRaptor created and activated (if needed)
- [ ] DataRaptors tested individually in preview

OmniScript:
- [ ] SetValues element configured with configDeveloperName
- [ ] DataRaptor actions added and configured
- [ ] Custom LWC element added to Review step
- [ ] LWC Component Name set to `c-intake-form-review-summary`

labelData JSON:
- [ ] Section keys match OmniScript Step names exactly
- [ ] Field keys match OmniScript Field API names exactly
- [ ] Block keys match OmniScript Block names exactly
- [ ] `_sectionTitle` added to each section
- [ ] `_order` property added for proper sorting
- [ ] Explicit `type` added for formatting (phone, currency, etc.)

Testing:
- [ ] Preview works with test data
- [ ] All sections display in correct order
- [ ] All fields show proper labels
- [ ] Currency/phone/date formatting works
- [ ] Mobile responsive layout works

---

## Deep Dive: Understanding the Code

Now that you have a working implementation, let's understand why the code works the way it does.

---

## Part 1: Understanding the Data Structures

### formData: What the User Entered

When a user fills out an OmniScript, the data is structured by step:

```json
{
  "MAEOED_EligibilityForm_Step": {
    "EligibilityForm_NonProfitStatus": "Yes",
    "EligibilityForm_Nonprofit_EIN": "12-3456789",
    "EligibilityForm_AnnualOperatingBudget": 500000
  },
  "MAEOED_ApplicantInformation_Step": {
    "ApplicantInformation_OD_Block": {
      "ApplicantInformation_OrgName": "Community Health Initiative",
      "ApplicantInformation_AnnualOperatingBudget": 750000
    },
    "ApplicantInformation_OC_Block": {
      "ApplicantInformation_CEOName": "Jane Smith",
      "ApplicantInformation_CEOEmail": "jane@example.org",
      "ApplicantInformation_CEOPhone": "5551234567"
    }
  }
}
```

Key observations:
- Data is grouped by step names (e.g., `MAEOED_EligibilityForm_Step`)
- Steps can contain blocks (e.g., `ApplicantInformation_OD_Block`)
- Blocks can be nested (address blocks inside contact blocks)
- Field names are technical (not user-friendly)

### labelData: How to Display It

This is where the magic happens. The labelData JSON tells our component:
- What label to show for each field
- In what order to display sections
- How to format values (phone, currency, etc.)
- How wide each field should be

```json
{
  "MAEOED_EligibilityForm_Step": {
    "_sectionTitle": "Eligibility Information",
    "_order": 1,
    "EligibilityForm_NonProfitStatus": "Non-Profit Status",
    "EligibilityForm_Nonprofit_EIN": "EIN Number",
    "EligibilityForm_AnnualOperatingBudget": {
      "label": "Annual Operating Budget",
      "type": "currency",
      "colspan": 6
    }
  },
  "MAEOED_ApplicantInformation_Step": {
    "_sectionTitle": "Applicant Information",
    "_order": 2,
    "ApplicantInformation_OD_Block": {
      "_blockTitle": "Organization Details",
      "_order": 1,
      "ApplicantInformation_OrgName": {
        "label": "Organization Name",
        "colspan": 12
      },
      "ApplicantInformation_AnnualOperatingBudget": {
        "label": "Annual Budget",
        "type": "currency",
        "colspan": 6
      }
    },
    "ApplicantInformation_OC_Block": {
      "_blockTitle": "CEO Information",
      "_order": 2,
      "ApplicantInformation_CEOName": "CEO Name",
      "ApplicantInformation_CEOEmail": {
        "label": "CEO Email",
        "type": "email"
      },
      "ApplicantInformation_CEOPhone": {
        "label": "CEO Phone",
        "type": "phone"
      }
    }
  }
}
```

### Why Store labelData in Custom Metadata?

Option 1: Hardcode in JavaScript ❌
```javascript
// Bad: Requires deployment for any label change
const labels = { "field1": "Label 1", ... };
```

Option 2: Store in Custom Setting ⚠️
- Limited to 255 characters per field
- Not version-controlled
- Hard to manage hierarchies

Option 3: Custom Metadata Type ✅
- Supports Long Text Area (131,072 characters)
- Deployable with metadata API
- Version-controlled
- Can have multiple records (one per form type)
- Cacheable for performance

---

## Part 2: The Lightning Web Component

### Core Design Decisions

Decision 1: Iterate Over labelData Keys (Not formData)

This is critical and often overlooked:

```javascript
// ❌ WRONG: Order depends on formData (unpredictable)
for (const key of Object.keys(this._formData)) {
    // Process...
}

// ✅ CORRECT: Order depends on labelData (controlled)
for (const key of Object.keys(this._labelData)) {
    const value = this._formData[key];
    // Process...
}
```

Why? 
- JavaScript object key order is not guaranteed
- DataRaptors can return keys in any order
- By iterating over labelData, we control the display order
- We can add `_order` property for explicit sorting

Decision 2: Handle Both OmniScript and Record Page Usage

The component needs to work in two contexts:

```javascript
// OmniScript provides data via this property
@api omniJsonData;

// Record Pages provide data via these properties
@api formData;
@api labelData;

initializeData() {
    // Try OmniScript first
    if (this.omniJsonData) {
        this._formData = this.omniJsonData;
        this._labelData = this.omniJsonData.labelData;
    }
    
    // Override with API properties if provided
    if (this.formData) {
        this._formData = this.formData;
    }
    if (this.labelData) {
        this._labelData = this.labelData;
    }
}
```

Decision 3: Use renderedCallback for OmniScript Preview

OmniScript Preview has a timing issue — `connectedCallback` runs before data is available:

```javascript
connectedCallback() {
    // In OmniScript Preview, omniJsonData might be null here!
    if (this.omniJsonData || this.formData) {
        this.initializeData();
    }
}

renderedCallback() {
    // Check if data has changed (handles delayed arrival)
    if (this.omniJsonData) {
        const currentHash = JSON.stringify(this.omniJsonData);
        if (this._lastOmniDataHash !== currentHash) {
            this._lastOmniDataHash = currentHash;
            this.initializeData();
        }
    }
}
```

Why hash comparison?
- `renderedCallback` runs multiple times
- We only want to re-process when data actually changes
- JSON.stringify creates a simple fingerprint

Decision 4: Parse String Values from Long Text Areas

When storing form data in Long Text Area fields, it comes back as a JSON string:

```javascript
// Data from DataRaptor might be:
// formData.Step1 = '{"field1": "value1", "field2": "value2"}'

// We need to parse it:
if (typeof value === 'string') {
    try {
        value = JSON.parse(value);
    } catch (e) {
        console.warn(`Failed to parse JSON for ${key}`);
        continue;
    }
}
```

### Key Code: Field Processing with Type Formatting

```javascript
processField(key, value, labelInfo) {
    // Determine label and formatting options
    let label, explicitType, colspan;
    
    if (typeof labelInfo === 'object' && labelInfo.label) {
        // Object format: { "label": "...", "type": "...", "colspan": 6 }
        label = labelInfo.label;
        explicitType = labelInfo.type;
        colspan = Math.min(Math.max(labelInfo.colspan || 6, 1), 12);
    } else if (typeof labelInfo === 'string') {
        // Simple format: "Field Label"
        label = labelInfo;
        colspan = 6; // Default half-width
    }

    // Determine field type (explicit or auto-detect)
    const fieldType = explicitType || this.detectFieldType(key, value);
    
    // Format the value based on type
    const displayValue = this.formatValue(value, fieldType);

    return {
        id: key,
        label,
        displayValue,
        spanClass: `field-item span-${colspan}`
    };
}
```

### Key Code: Smart Type Detection

```javascript
detectFieldType(key, value) {
    const keyLower = key.toLowerCase();
    
    // Check value type first
    if (typeof value === 'boolean') return 'boolean';
    
    // Check key name patterns
    if (keyLower.includes('email')) return 'email';
    if (keyLower.includes('phone') || keyLower.includes('tel')) return 'phone';
    if (keyLower.includes('amount') || keyLower.includes('budget') || 
        keyLower.includes('cost') || keyLower.includes('price')) return 'currency';
    if (keyLower.includes('date')) return 'date';
    
    // Check value patterns
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    
    return 'text';
}
```

Why auto-detect?
- Reduces configuration burden
- Works for simple cases without explicit types
- Explicit type always takes precedence (override when needed)

### Key Code: Value Formatting

```javascript
formatValue(value, fieldType) {
    if (value === null || value === undefined || value === '') return '—';

    switch (fieldType) {
        case 'currency':
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(parseFloat(value));
        
        case 'phone':
            // Format: (XXX) XXX-XXXX
            const cleaned = String(value).replace(/\D/g, '');
            if (cleaned.length === 10) {
                return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
            }
            return String(value);
        
        case 'date':
            return new Date(value).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        
        case 'boolean':
            return value === true || value === 'true' || value === 'Yes' 
                ? 'Yes' : 'No';
        
        case 'email':
            return String(value).toLowerCase().trim();
        
        default:
            return String(value);
    }
}
```

Why use Intl.NumberFormat for currency?
- Handles localization automatically
- Adds proper currency symbol
- Formats with thousands separators
- Respects decimal places

---

## Part 3: The 12-Column Grid System

### Why 12 Columns?

12 is divisible by 1, 2, 3, 4, 6, and 12 — giving maximum layout flexibility:

| colspan | Width | Use Case |
|---------|-------|----------|
| 12 | 100% | Descriptions, addresses |
| 6 | 50% | Most fields (default) |
| 4 | 33% | Compact fields like dates |
| 3 | 25% | Quarterly data, ratings |
| 2 | 16.6% | Very compact data |

### CSS Implementation

```css
.field-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 0.75rem 1rem;
}

/* Generate span classes */
.span-1  { grid-column: span 1; }
.span-2  { grid-column: span 2; }
.span-3  { grid-column: span 3; }
.span-4  { grid-column: span 4; }
.span-5  { grid-column: span 5; }
.span-6  { grid-column: span 6; }
.span-7  { grid-column: span 7; }
.span-8  { grid-column: span 8; }
.span-9  { grid-column: span 9; }
.span-10 { grid-column: span 10; }
.span-11 { grid-column: span 11; }
.span-12 { grid-column: span 12; }

/* Responsive: Stack on mobile */
@media (max-width: 768px) {
    .field-grid {
        grid-template-columns: 1fr;
    }
    [class*="span-"] {
        grid-column: span 1;
    }
}
```

Why CSS Grid over Flexbox?
- Grid handles 2D layouts naturally
- `span` property makes it easy to control width
- Responsive behavior is simpler to implement
- Better alignment of fields in rows

---

## Part 4: OmniScript Integration

### Step 1: Create the SetValues Element

In OmniScript Designer, add a SetValues element with:

```json
{
  "configDeveloperName": "MAEOED_Proposal_Config",
  "recordId": "=IF(%isPortalUser%, %recordId%, %ContextId%)",
  "isPortalUser": "=%userProfile% != \"System Administrator\""
}
```

Why this logic?
- Portal users have `recordId` in URL parameters
- Internal users use `ContextId` from the record page
- This makes the OmniScript work in both contexts

### Step 2: DataRaptor for Label Configuration

Name: `DRExtractLabelJSON`

Input:
| Key | Value |
|-----|-------|
| configDeveloperName | `%configDeveloperName%` |

Extract:
| Field | Path |
|-------|------|
| Label_JSON__c | labelData |

Filter: `DeveloperName = :configDeveloperName AND Is_Active__c = true`

Why cache this DataRaptor?
- Label configuration rarely changes
- Caching reduces SOQL queries
- Set TTL to 60 minutes in Platform Cache

### Step 3: DataRaptor for Form Data

Name: `DRExtractFormData`

Input:
| Key | Value |
|-----|-------|
| recordId | `%recordId%` |

Extract: Map your Long Text Area fields to step node names.

### Step 4: Add the Custom LWC

1. In OmniScript Designer, add a Step
2. Inside the step, add a Custom Lightning Web Component
3. Set LWC Component Name: `c-intake-form-review-summary`
4. The component automatically receives `omniJsonData`

---

## Part 5: Supporting Multiple Forms

### The Power of Configuration

To add support for a new form type:

1. Create a new Custom Metadata record:
   - Developer Name: `Grant_Application_Config`
   - Label_JSON__c: (your JSON)

2. Update SetValues:
   ```json
   { "configDeveloperName": "Grant_Application_Config" }
   ```

3. Done! No code changes needed.

### Dynamic Form Type Selection

For truly dynamic routing:

```json
{
  "configDeveloperName": "=CASE(%ObjectType%, 
    'Proposal__c', 'Proposal_Config',
    'Grant__c', 'Grant_Config',
    'Vendor__c', 'Vendor_Config',
    'Default_Config'
  )"
}
```

---

## Part 6: Troubleshooting Guide

### Problem: "No data available to display"

Root Cause: labelData keys don't match formData keys.

Debug Steps:
1. Open browser DevTools (F12)
2. Look for console log: `omniJsonData`
3. Compare keys between formData and labelData
4. Keys must match exactly (case-sensitive)

Fix: Update your labelData JSON to use exact field names from your OmniScript.

### Problem: Sections in Wrong Order

Root Cause: JavaScript object key order is not guaranteed.

Fix: Add `_order` property:
```json
{
  "Step1": { "_sectionTitle": "First", "_order": 1 },
  "Step2": { "_sectionTitle": "Second", "_order": 2 }
}
```

### Problem: Component Loads Forever in Preview

Root Cause: `connectedCallback` ran before data was available.

Fix: Use the latest component version that handles delayed data in `renderedCallback`.

### Problem: Phone/Currency Not Formatting

Root Cause: Type not specified.

Fix: Use object format with explicit type:
```json
{
  "phoneField": { "label": "Phone", "type": "phone" }
}
```

---

## Performance Best Practices

### 1. Cache Label Configuration

```
Platform Cache Settings:
- Partition: YourOrg.FormConfig
- TTL: 3600 seconds (1 hour)
- DataRaptor: Enable "Use Platform Cache"
```

### 2. Minimize DataRaptor Calls

- Fetch all data in one DataRaptor call when possible
- Use Response Actions to merge results

### 3. Lazy Load Sections

For forms with 100+ fields:
```javascript
// Only process visible sections
section.isExpanded = index < 3; // First 3 expanded by default
```

---

## Conclusion

We've built a production-ready Review Summary component that:

✅ Works for any form — just update the labelData JSON  
✅ Handles complex nesting — blocks within blocks within sections  
✅ Formats data intelligently — phone, email, currency, dates  
✅ Looks professional — 12-column responsive grid  
✅ Performs well — caching, lazy loading options  
✅ Is maintainable — clear separation of concerns  

The key architectural insight is configuration over code. By separating the display configuration (labelData) from the rendering logic (LWC), we created a system that scales with your organization's needs.

---

## Resources

- Full Source Code: [github.com/Rdevang/Review-Summary-LWC](https://github.com/Rdevang/Review-Summary-LWC)
- Salesforce LWC Documentation: [developer.salesforce.com/docs/component-library](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- OmniStudio Developer Guide: [help.salesforce.com/s/articleView?id=sf.omnistudio.htm](https://help.salesforce.com/s/articleView?id=sf.omnistudio.htm)

---

*If this helped you, give it a 👏 and follow for more Salesforce architecture deep-dives!*

Tags: `#Salesforce` `#OmniStudio` `#LWC` `#JavaScript` `#WebDevelopment`

---

## About the Author

*Connect on [LinkedIn](https://linkedin.com/in/yourprofile) | [GitHub](https://github.com/Rdevang)*
