import { LightningElement, api, track } from 'lwc';
import { OmniscriptBaseMixin } from 'omnistudio/omniscriptBaseMixin';

/**
 * Config-driven synthetic sections embedded into the review summary.
 *   BudgetStep   -> c-budget-display-read-only (GRANTS only, proposal-based)
 *   DocumentStep -> c-unified-document-display (LPI + GRANTS, driven by Org_Type)
 *
 * `orgTypes` lists the Org_Type values that enable each section. When omitted the
 * section is enabled for all orgs.
 */
const SECTION_CONFIG = {
    BudgetStep: {
        order: 4.5,
        sectionTitle: 'Budget Review',
        recordIdFields: ['recordId', 'proposalId', 'ProposalId', 'proposalID', 'Proposal__c', 'proposal__c'],
        orgTypes: ['GRANTS']
    },
    DocumentStep: {
        order: 4.6,
        sectionTitle: 'Document Review',
        // LPI: PAR/BLA Id. GRANTS: proposal Id. Both are covered by the ordered lookup below.
        recordIdFields: [
            'recordId', 'recordID', 'ContextId',
            'parId', 'PARId', 'PAR__c',
            'blaId', 'BLAId', 'Business_License_Application__c',
            'proposalId', 'ProposalId', 'proposalID', 'Proposal__c', 'proposal__c'
        ],
        orgTypes: ['LPI', 'GRANTS']
    }
};

const ORG_TYPE_FIELDS = ['Org_Type', 'OrgType', 'orgType', 'org_type'];

const USER_PROFILE_FIELDS = ['userProfile', 'UserProfile', 'profile'];
const ADMIN_PROFILE = 'system administrator';

/**
 * @description Utility LWC to display Review and Summary for intake forms.
 *              Designed to run as a Custom LWC inside OmniStudio OmniScripts.
 *              Reads data from `omniJsonData` and handles nested objects/arrays.
 */
export default class PocIntakeformreviewsummary extends OmniscriptBaseMixin(LightningElement) {

    // OmniScript data - received when used as Custom LWC in OmniStudio
    @api omniJsonData;

    // Optional: hide fields whose value is empty
    @api hideEmptyFields = false;

    // Configurable fields to skip (comma-separated string). Appended to built-in skip list.
    @api
    get skipFieldsList() {
        return this._customSkipFields.join(',');
    }
    set skipFieldsList(value) {
        if (typeof value === 'string') {
            this._customSkipFields = value.split(',').map(f => f.trim()).filter(f => f);
        } else if (Array.isArray(value)) {
            this._customSkipFields = value;
        }
    }

    // Track processed data for rendering
    @track processedSections = [];
    @track isLoading = true;
    @track hasError = false;
    @track errorMessage = '';

    // Internal data holders
    _formData = null;
    _labelData = null;

    // OmniScript metadata keys that should never render as sections
    _systemSkipFields = [
        'objectApiName', 'fieldsList', 'recordId', 'recordID',
        'ContextId', 'userProfile', 'timeStamp', 'userTimeZoneName',
        'userTimeZone', 'userCurrencyCode', 'userName', 'userId',
        'omniProcessId', 'localTimeZoneName', 'configDeveloperName',
        'isPortalUser', 'labelData', 'labels', 'fieldLabels',
        'formData', 'reviewData'
    ];

    // User-provided skip fields via skipFieldsList property
    _customSkipFields = [];

    // Combined skip list used at processing time
    get _skipFields() {
        return [...this._systemSkipFields, ...this._customSkipFields];
    }

    _lastOmniDataRef = null;
    _lastOmniDataHash = null;

    // Section-level edit state: drafts keyed by sectionId, Set of sectionIds currently in edit mode
    _drafts = {};
    _editingSections = new Set();

    connectedCallback() {
        if (this.omniJsonData) {
            this.initializeData();
        }
    }

    /**
     * @description Re-initialize when omniJsonData changes (OmniScript navigation)
     *              Also handles initial data arrival in OmniScript Preview
     */
    renderedCallback() {
        if (!this.omniJsonData) return;
        // Fast path: reference equality. Fallback: stringify (only when reference differs).
        if (this._lastOmniDataRef === this.omniJsonData) return;
        const currentHash = JSON.stringify(this.omniJsonData);
        if (this._lastOmniDataHash !== currentHash) {
            this._lastOmniDataRef = this.omniJsonData;
            this._lastOmniDataHash = currentHash;
            this.initializeData();
        } else {
            this._lastOmniDataRef = this.omniJsonData;
        }
    }

    /**
     * @description Initialize data from OmniScript payload
     */
    initializeData() {
        this.hasError = false;
        this.errorMessage = '';
        this.isLoading = true;

        try {
            if (!this.omniJsonData) {
                this.hasError = true;
                this.errorMessage = 'No OmniScript data provided.';
                this.isLoading = false;
                return;
            }

            // Form data: prefer nested formData/reviewData, else treat whole payload as form data
            this._formData = this.omniJsonData.formData
                || this.omniJsonData.reviewData
                || this.omniJsonData;

            // Label data: object or JSON string
            const labelSource = this.omniJsonData.labelData
                || this.omniJsonData.labels
                || this.omniJsonData.fieldLabels
                || {};
            this._labelData = typeof labelSource === 'string'
                ? this._safeParseJson(labelSource, {})
                : labelSource;

            this.processFormData();
            this.isLoading = false;
        } catch (error) {
            this.hasError = true;
            this.errorMessage = 'Error processing form data: ' + error.message;
            this.isLoading = false;
        }
    }

    /**
     * @description Safely parse JSON string, returning fallback on failure
     */
    _safeParseJson(value, fallback) {
        try {
            return JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

    /**
     * @description Process form data into sections for rendering
     * Only processes sections that have labels defined in labelData.
     * Section order: form sections use labelData _order; synthetic sections (Budget, Document) use SECTION_CONFIG order.
     * All sections are combined and sorted by order (ascending)—no insert-by-index logic.
     */
    processFormData() {
        const sections = [];

        // Get all section keys from labelData
        const keysToProcess = this._labelData ? Object.keys(this._labelData) : [];

        for (const key of keysToProcess) {
            // Skip system fields (configurable via skipFieldsList)
            if (this._skipFields.includes(key)) continue;

            const labelInfo = this._labelData[key];

            // Skip if labelInfo is not a section (e.g. internal keys)
            if (!labelInfo || typeof labelInfo !== 'object') continue;

            // Route section value to draft when that section is currently being edited,
            // so inputs display the in-progress values.
            let value = this._editingSections.has(key)
                ? this._drafts[key]
                : this._formData[key];

            // Parse JSON string if the value is a string (from Long Text Area fields)
            if (typeof value === 'string') {
                value = this._safeParseJson(value, undefined);
            }

            // When value is missing (e.g. internal user OmniScript only passed labelData, not step data),
            // still add a section so the header appears; processSection with empty object yields section with no blocks/fields
            if (value === undefined || value === null) {
                value = {};
            }

            // Process based on value type
            if (this.isObject(value) && !Array.isArray(value)) {
                const section = this.processSection(key, value, labelInfo);
                if (section) {
                    section.order = (labelInfo && typeof labelInfo._order === 'number')
                        ? labelInfo._order
                        : 999;
                    sections.push(section);
                }
            }
        }

        // Sort sections by _order property (ascending)
        sections.sort((a, b) => a.order - b.order);

        // Add synthetic sections (Budget Review, Document Review) and re-sort so order is
        // strictly from SECTION_CONFIG (synthetic) and labelData _order (form). No insert-by-index.
        const syntheticSections = this.buildSyntheticSections();
        if (syntheticSections.length > 0) {
            sections.push(...syntheticSections);
            sections.sort((a, b) => a.order - b.order);
        }

        this.processedSections = sections;
    }

    /**
     * @description Resolve record Id from form/omni data for a config key (e.g. BudgetStep).
     * Tries recordIdFields at root of formData, then inside any step, then on full omniJsonData
     * (OmniScript often puts recordId on the parent when formData is a nested object).
     */
    getRecordIdFromConfig(configKey) {
        const config = SECTION_CONFIG[configKey];
        if (!config || !config.recordIdFields) return null;

        const tryData = (data) => {
            if (!data || typeof data !== 'object') return null;
            for (const field of config.recordIdFields) {
                const val = data[field];
                if (val !== undefined && val !== null && val !== '') {
                    return typeof val === 'string' ? val.trim() : String(val);
                }
            }
            return null;
        };

        // 1) Root of form data
        if (this._formData) {
            let id = tryData(this._formData);
            if (id) return id;
            // 2) Inside any step object
            for (const key of Object.keys(this._formData)) {
                const val = this._formData[key];
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    id = tryData(val);
                    if (id) return id;
                }
            }
        }

        // 3) Full OmniScript payload (recordId often on parent when formData is nested)
        if (this.omniJsonData) {
            const id = tryData(this.omniJsonData);
            if (id) return id;
        }
        return null;
    }

    /**
     * @description Build synthetic sections from SECTION_CONFIG (e.g. Budget Review, Document Review).
     * Injects steps with recordId; summary embeds child LWCs (c-budget-display-read-only, c-document-display-read-only).
     */
    buildSyntheticSections() {
        const out = [];
        const orgType = this.getOrgType();
        for (const [sectionId, config] of Object.entries(SECTION_CONFIG)) {
            // Skip sections whose orgTypes list does not include the current org
            if (Array.isArray(config.orgTypes) && config.orgTypes.length > 0) {
                if (!orgType || !config.orgTypes.includes(orgType)) continue;
            }
            const recordId = this.getRecordIdFromConfig(sectionId);
            if (!recordId) continue;
            const isBudget = sectionId === 'BudgetStep';
            const isDocument = sectionId === 'DocumentStep';
            out.push({
                id: sectionId,
                title: config.sectionTitle || sectionId,
                contentId: `content-${sectionId}`,
                isExpanded: true,
                chevronIcon: 'utility:chevrondown',
                order: config.order ?? 999,
                showBudgetChild: isBudget,
                showDocumentChild: isDocument,
                recordId: recordId,
                orgType: orgType,
                blocks: [],
                fields: [],
                hasFields: false,
                hasBlocks: false,
                isSynthetic: true,
                isEditable: false,
                isEditing: false,
                showActions: false
            });
        }
        return out;
    }

    /**
     * @description True when Edit/Save/Cancel controls should be available.
     * Controls are hidden only when userProfile is explicitly 'System Administrator'
     * (case-insensitive). When the profile key is missing we default to editable.
     */
    get canEditGlobally() {
        const profile = this._readUserProfile();
        if (!profile) return true;
        return String(profile).trim().toLowerCase() !== ADMIN_PROFILE;
        //return true;
    }

    _readUserProfile() {
        const pick = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            for (const key of USER_PROFILE_FIELDS) {
                const v = obj[key];
                if (v !== undefined && v !== null && v !== '') return v;
            }
            return null;
        };
        return pick(this.omniJsonData) || pick(this._formData);
    }

    /**
     * @description Read Org_Type from omniJsonData (root) or from the active form data.
     *              Returns the value upper-cased, or null if absent.
     */
    getOrgType() {
        const pick = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            for (const key of ORG_TYPE_FIELDS) {
                const v = obj[key];
                if (v !== undefined && v !== null && v !== '') {
                    return String(v).trim().toUpperCase();
                }
            }
            return null;
        };
        return pick(this.omniJsonData) || pick(this._formData) || null;
    }

    /**
     * @description Process a section (step) with its nested content
     * Only includes fields/blocks that have labels defined
     * IMPORTANT: Iterates over sectionLabels keys to preserve JSON order
     */
    processSection(sectionKey, sectionData, sectionLabels) {
        // Use _sectionTitle from labels, or format from key
        const sectionTitle = (sectionLabels && sectionLabels._sectionTitle)
            ? sectionLabels._sectionTitle
            : this.formatSectionTitle(sectionKey);

        const isEditing = this._editingSections.has(sectionKey);
        const section = {
            id: sectionKey,
            title: sectionTitle,
            contentId: `content-${sectionKey}`,
            isExpanded: true,
            chevronIcon: 'utility:chevrondown',
            blocks: [],
            fields: [],
            isSynthetic: false,
            isEditable: true,
            isEditing: isEditing,
            showActions: this.canEditGlobally
        };

        const parentPath = [sectionKey];

        // Iterate over sectionLabels keys in _order (ascending) for correct display order
        const keysToProcess = sectionLabels ? this.getOrderedKeys(sectionLabels) : [];

        for (const key of keysToProcess) {
            // Skip internal label keys
            if (key.startsWith('_')) continue;

            const value = sectionData[key];
            const labelInfo = sectionLabels[key];

            // Skip if no corresponding data exists
            if (value === undefined) continue;

            if (Array.isArray(value)) {
                // It's an array - process as repeatable block (needs _blockTitle or field labels)
                const arrayBlock = this.processArray(key, value, labelInfo, parentPath);
                if (arrayBlock) {
                    section.blocks.push(arrayBlock);
                }
            } else if (this.isObject(value)) {
                const block = this.processBlock(key, value, labelInfo, parentPath);
                if (block) {
                    if (block.isAddressBlock) {
                        const addressField = this.makeAddressField(key, block.title, block.fullAddressValue, labelInfo, parentPath, block.addressSubFields);
                        section.fields.push(addressField);
                    } else {
                        section.blocks.push(block);
                    }
                }
            } else {
                // It's a simple field - labelInfo can be string or object with label/type
                const isValidLabel = typeof labelInfo === 'string' ||
                    (typeof labelInfo === 'object' && labelInfo.label);
                if (isValidLabel) {
                    const field = this.processField(key, value, labelInfo, parentPath);
                    if (field && (!this.hideEmptyFields || field.displayValue !== '—')) {
                        section.fields.push(field);
                    }
                }
            }
        }

        // Add computed properties
        section.hasFields = section.fields.length > 0;
        section.hasBlocks = section.blocks.length > 0;

        // Return section even when empty (no blocks/fields) so header shows when form data is missing
        return section;
    }

    /**
     * @description Process a nested block
     * Only includes fields that have labels defined in blockLabels
     * IMPORTANT: Iterates over blockLabels keys to preserve JSON order
     */
    processBlock(blockKey, blockData, blockLabels, parentPath = []) {
        // Block must have labels defined (either _blockTitle or field labels)
        if (!blockLabels || typeof blockLabels !== 'object') {
            return null;
        }

        const blockTitle = this.formatBlockTitle(blockKey, blockLabels);
        const blockPath = [...parentPath, blockKey];
        const block = {
            id: blockKey,
            title: blockTitle,
            isBlock: true,
            isArray: false,
            fields: [],
            nestedBlocks: [],
            content: [] // ordered list: { type: 'field'|'nestedBlock', id, item } for correct label JSON order
        };

        // Use _fieldOrder (or _order) so field/block order matches label JSON
        for (const key of this.getBlockContentKeys(blockLabels)) {
            if (key.startsWith('_')) continue;

            const value = blockData[key];
            const labelInfo = blockLabels[key];

            if (value === undefined) continue;

            if (this.isObject(value) && !Array.isArray(value)) {
                if (typeof labelInfo === 'object') {
                    const nestedBlock = this.processBlock(key, value, labelInfo, blockPath);
                    if (nestedBlock) {
                        if (nestedBlock.isAddressBlock) {
                            // Show address as a normal field in the grid (half width unless _addressColspan in label JSON)
                            const addressField = this.makeAddressField(key, nestedBlock.title, nestedBlock.fullAddressValue, labelInfo, blockPath, nestedBlock.addressSubFields);
                            block.fields.push(addressField);
                            block.content.push({
                                type: 'field',
                                id: addressField.id,
                                item: addressField,
                                isField: true,
                                isNestedBlock: false
                            });
                        } else {
                            block.nestedBlocks.push(nestedBlock);
                            block.content.push({
                                type: 'nestedBlock',
                                id: `nested_${key}`,
                                item: nestedBlock,
                                isField: false,
                                isNestedBlock: true
                            });
                        }
                    }
                }
            } else if (!Array.isArray(value)) {
                const isValidLabel = typeof labelInfo === 'string' ||
                    (typeof labelInfo === 'object' && labelInfo.label);
                if (isValidLabel) {
                    const field = this.processField(key, value, labelInfo, blockPath);
                    if (field && (!this.hideEmptyFields || field.displayValue !== '—')) {
                        block.fields.push(field);
                        block.content.push({
                            type: 'field',
                            id: field.id,
                            item: field,
                            isField: true,
                            isNestedBlock: false
                        });
                    }
                }
            }
        }

        // Address blocks: keep only Full Address value for read-only render, but carry all sub-fields for edit mode.
        if (this.isAddressBlock(blockKey, blockLabels)) {
            const fullAddressField = block.fields.find(f => f.label === 'Full Address');
            // Preserve all non-"Full Address" sub-fields so edit mode can expose them as inputs
            block.addressSubFields = block.fields.filter(f => f.label !== 'Full Address');
            if (fullAddressField) {
                block.fields = [fullAddressField];
                block.isAddressBlock = true;
                block.fullAddressValue = fullAddressField.displayValue;
            }
            block.content = []; // address block renders as title + value only, no content list
        }

        if (block.fields.length > 0 || block.nestedBlocks.length > 0 || block.content.length > 0) {
            return block;
        }
        return null;
    }

    /**
     * @description Whether this block is an address sub-block (e.g. Applicant Address, Owner Address).
     * Used to show only "Full Address" and hide Street/City/State/Zip/Country.
     */
    isAddressBlock(blockKey, blockLabels) {
        if (!blockKey || !blockLabels) return false;
        const keyLower = blockKey.toLowerCase();
        const title = (blockLabels._blockTitle || '').toLowerCase();
        return (keyLower.includes('address') && keyLower.includes('block')) || title.includes('address');
    }

    /**
     * @description Create a field-shaped object for address so it renders in the grid like other fields.
     * Uses half width (colspan 6) by default unless overridden via label JSON _addressColspan.
     */
    makeAddressField(key, label, displayValue, blockLabels, parentPath = [], subFields = []) {
        const colspan = (blockLabels && typeof blockLabels._addressColspan === 'number')
            ? Math.min(Math.max(blockLabels._addressColspan, 1), 12)
            : 6;
        const path = [...parentPath, key];
        return {
            id: key,
            key: key,
            label: label,
            value: displayValue,
            displayValue: displayValue || '—',
            fieldType: 'address',
            isBoolean: false,
            isMultiSelect: false,
            displayValues: [],
            colspan: colspan,
            spanClass: `field-item span-${colspan}`,
            // Edit-mode metadata
            isAddressField: true,
            addressSubFields: Array.isArray(subFields) ? subFields : [],
            path: path,
            pathJson: JSON.stringify(path),
            // Non-editable wrapper field (sub-fields drive individual inputs in edit mode)
            inputType: 'text',
            isCheckbox: false,
            rawValue: displayValue
        };
    }

    /**
     * @description Process an array as a repeatable block with items
     * Only includes fields that have labels defined
     * IMPORTANT: Iterates over itemLabels keys to preserve JSON order
     */
    processArray(arrayKey, arrayData, arrayLabels, parentPath = []) {
        if (!arrayLabels) return null;

        // Get item labels - supports both object format and array format
        const itemLabels = typeof arrayLabels === 'object' && !Array.isArray(arrayLabels)
            ? arrayLabels
            : (Array.isArray(arrayLabels) && arrayLabels.length > 0 ? arrayLabels[0] : null);

        if (!itemLabels) return null;

        const arrayPath = [...parentPath, arrayKey];
        const block = {
            id: arrayKey,
            title: (itemLabels && itemLabels._blockTitle) || this.formatBlockTitle(arrayKey, itemLabels),
            isBlock: true,
            isArray: true,
            items: [],
            columns: [],
            arrayPath: arrayPath,
            arrayPathJson: JSON.stringify(arrayPath),
            // Keys used when adding a new empty row
            rowSchemaKeys: this.getKeysInDocumentOrder(itemLabels),
            rowSchemaJson: JSON.stringify(this.getKeysInDocumentOrder(itemLabels))
        };

        // Get label keys in document order (same as label JSON) for column/field order
        const labelKeys = block.rowSchemaKeys;

        // Build columns once from labels so headers render even when array is empty (edit mode).
        for (const key of labelKeys) {
            const labelInfo = itemLabels[key];
            const isValidLabel = typeof labelInfo === 'string' ||
                (typeof labelInfo === 'object' && labelInfo.label);
            if (!isValidLabel) continue;
            const label = typeof labelInfo === 'string' ? labelInfo : labelInfo.label;
            block.columns.push({ label, fieldName: key });
        }

        const rows = Array.isArray(arrayData) ? arrayData : [];

        // Process each item in the array
        rows.forEach((item, index) => {
            const rowPath = [...arrayPath, index];
            const processedItem = {
                id: `${arrayKey}_${index}`,
                index: index + 1,
                rowIndex: index,
                rowPath: rowPath,
                rowPathJson: JSON.stringify(rowPath),
                fields: []
            };

            // Iterate over itemLabels keys to preserve the order defined in JSON
            for (const key of labelKeys) {
                const labelInfo = itemLabels[key];

                // Only include fields with valid labels (string or object with label)
                const isValidLabel = typeof labelInfo === 'string' ||
                    (typeof labelInfo === 'object' && labelInfo.label);
                if (!isValidLabel) continue;

                const rawValue = item != null && typeof item === 'object' ? item[key] : undefined;
                // For display, undefined renders as em-dash via processField. Keep undefined for edit binding.
                const value = rawValue === undefined ? '' : rawValue;
                const field = this.processField(key, value, labelInfo, rowPath);

                if (field && (!this.hideEmptyFields || field.displayValue !== '—')) {
                    processedItem.fields.push(field);
                }
            }

            // Always push the row so array rows remain navigable in edit mode even if all
            // fields are blank. Read-only mode will still only render when row has fields.
            processedItem.hasFields = processedItem.fields.length > 0;
            block.items.push(processedItem);
        });

        // In read-only mode, suppress the block when there are no items.
        block.isEmpty = block.items.length === 0;
        return block;
    }

    /**
     * @description Process a single field
     * @param {string} key - Field key
     * @param {*} value - Field value
     * @param {string|object} labelInfo - Label from labelData. Can be:
     *   - String: "Label Text" (auto-detect type)
     *   - Object: { "label": "Label Text", "type": "phone|email|currency|date|boolean|number", "colspan": 1-12 }
     */
    processField(key, value, labelInfo, parentPath = []) {
        // Label is required - if not provided, don't show the field
        if (!labelInfo) {
            return null;
        }

        // Support both string and object format for labelInfo
        let label, explicitType, colspan;
        if (typeof labelInfo === 'object' && labelInfo.label) {
            label = labelInfo.label;
            explicitType = labelInfo.type;
            // Extract colspan (default 6 for half-width, clamp to 1-12)
            colspan = typeof labelInfo.colspan === 'number'
                ? Math.min(Math.max(labelInfo.colspan, 1), 12)
                : 6;
        } else if (typeof labelInfo === 'string') {
            label = labelInfo;
            explicitType = null;
            colspan = 6; // Default half-width
        } else {
            return null;
        }

        // Use explicit type if provided, otherwise auto-detect
        const fieldType = explicitType || this.detectFieldType(key, value);
        const displayValue = this.formatValue(value, fieldType);
        const isBoolean = fieldType === 'boolean';

        // Multi-select: values separated by semicolon — show as pills/tags (id for unique key in LWC)
        const isMultiSelect = fieldType === 'multiselect' ||
            (typeof value === 'string' && value.trim().indexOf(';') >= 0);
        const rawString = value != null && typeof value === 'string' ? value : '';
        const displayValues = isMultiSelect
            ? rawString.split(';').map(s => s.trim()).filter(Boolean).map((s, i) => ({ id: `${key}_${i}`, value: s }))
            : [];

        // Edit-mode metadata
        const path = [...parentPath, key];
        const inputType = this._inputTypeFor(fieldType);
        const formatter = fieldType === 'currency' ? 'currency' : undefined;
        // lightning-input expects `value` for most types and `checked` for checkbox.
        const booleanChecked = isBoolean ? this._coerceBoolean(value) : false;

        return {
            id: key,
            key: key,
            label: label,
            value: value,
            displayValue: displayValue,
            fieldType: fieldType,
            isBoolean: isBoolean,
            isMultiSelect: isMultiSelect && displayValues.length > 0,
            displayValues: displayValues,
            isCurrency: fieldType === 'currency',
            isDate: fieldType === 'date',
            isEmail: fieldType === 'email',
            isPhone: fieldType === 'phone',
            isNumber: fieldType === 'number',
            isText: !['boolean', 'currency', 'date', 'email', 'phone', 'number', 'multiselect'].includes(fieldType),
            // Pre-computed values for boolean display (LWC doesn't support ternary in templates)
            booleanIcon: isBoolean ? (value ? 'utility:check' : 'utility:close') : '',
            booleanIconClass: isBoolean ? (value ? 'icon-success' : 'icon-error') : '',
            // Colspan for 12-column grid layout
            colspan: colspan,
            spanClass: `field-item span-${colspan}`,
            // Edit-mode metadata (consumed by the template when section.isEditing)
            path: path,
            pathJson: JSON.stringify(path),
            inputType: inputType,
            isCheckbox: isBoolean,
            formatter: formatter,
            rawValue: value == null ? '' : value,
            booleanChecked: booleanChecked,
            // Multi-select is read-only in edit mode (v1)
            isEditableField: !isMultiSelect
        };
    }

    /**
     * @description Map a detected/explicit field type to a lightning-input `type`.
     */
    _inputTypeFor(fieldType) {
        switch (fieldType) {
            case 'email': return 'email';
            case 'phone': return 'tel';
            case 'number': return 'number';
            case 'currency': return 'number';
            case 'date': return 'date';
            case 'boolean': return 'checkbox';
            default: return 'text';
        }
    }

    _coerceBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (value == null) return false;
        const s = String(value).trim().toLowerCase();
        return s === 'true' || s === 'yes' || s === '1';
    }

    /**
     * @description Detect field type based on key name and value
     */
    detectFieldType(key, value) {
        const keyLower = key.toLowerCase();

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        if (keyLower.includes('email')) {
            return 'email';
        }

        if (keyLower.includes('phone') || keyLower.includes('tel')) {
            return 'phone';
        }

        if (keyLower.includes('amount') || keyLower.includes('budget') || keyLower.includes('cost') || keyLower.includes('price')) {
            return 'currency';
        }

        if (keyLower.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) {
            return 'date';
        }

        return 'text';
    }

    /**
     * @description Format value for display based on field type
     */
    formatValue(value, fieldType) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        // Multi-select: keep raw string for fallback; UI shows as pills
        if (fieldType === 'multiselect' && typeof value === 'string') {
            return value;
        }

        // Boolean formatting
        if (typeof value === 'boolean' || fieldType === 'boolean') {
            if (typeof value === 'boolean') {
                return value ? 'Yes' : 'No';
            }
            // Handle string booleans
            const strVal = String(value).toLowerCase();
            if (strVal === 'true' || strVal === 'yes') return 'Yes';
            if (strVal === 'false' || strVal === 'no') return 'No';
            return String(value);
        }

        // Currency formatting
        if (fieldType === 'currency') {
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            if (!isNaN(numValue)) {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(numValue);
            }
            return String(value);
        }

        // Phone number formatting
        if (fieldType === 'phone') {
            return this.formatPhoneNumber(value);
        }

        // Email formatting (lowercase, trimmed)
        if (fieldType === 'email') {
            return String(value).trim().toLowerCase();
        }

        // Date formatting
        if (fieldType === 'date') {
            return this.formatDate(value);
        }

        // Number formatting
        if (fieldType === 'number') {
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            if (!isNaN(numValue)) {
                return numValue.toLocaleString('en-US');
            }
            return String(value);
        }

        // Default: return as string
        if (typeof value === 'number') {
            return value.toLocaleString();
        }

        return String(value);
    }

    /**
     * @description Format phone number to (XXX) XXX-XXXX format
     */
    formatPhoneNumber(value) {
        if (!value) return '—';

        // Remove all non-numeric characters
        const cleaned = String(value).replace(/\D/g, '');

        // Format based on length
        if (cleaned.length === 10) {
            // US format: (XXX) XXX-XXXX
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            // US with country code: +1 (XXX) XXX-XXXX
            return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length > 10) {
            // International: +XX XXX XXX XXXX
            return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
        }

        // Return original if can't format
        return String(value);
    }

    /**
     * @description Format date to readable format
     */
    formatDate(value) {
        if (!value) return '—';

        try {
            let date;

            // Handle different date formats
            if (typeof value === 'string') {
                // ISO format: YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    const [year, month, day] = value.split('-').map(Number);
                    date = new Date(year, month - 1, day);
                } else {
                    date = new Date(value);
                }
            } else if (value instanceof Date) {
                date = value;
            } else {
                return String(value);
            }

            // Check if valid date
            if (isNaN(date.getTime())) {
                return String(value);
            }

            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return String(value);
        }
    }

    /**
     * @description Format section title from key (generic - no hardcoded prefixes)
     * @param {string} key - The section key
     * @returns {string} Formatted title
     */
    formatSectionTitle(key) {
        // Remove common suffixes like _Step, _Section, _Form
        let title = key
            .replace(/[_-](Step|Section|Form|Page)$/i, '')
            .replace(/[_-]/g, ' ');

        // Add spaces before capital letters (camelCase to Title Case)
        title = title.replace(/([a-z])([A-Z])/g, '$1 $2');

        // Capitalize first letter of each word
        title = title.replace(/\b\w/g, l => l.toUpperCase());

        return title.trim();
    }

    /**
     * @description Format block title from key (generic - uses label JSON for titles)
     * @param {string} key - The block key
     * @param {object} blockLabels - Optional label data for the block (may contain _blockTitle)
     * @returns {string} Formatted title - prefers _blockTitle from labels if available
     */
    formatBlockTitle(key, blockLabels = null) {
        // PRIORITY 1: Use _blockTitle from label JSON if provided
        if (blockLabels && typeof blockLabels === 'object' && blockLabels._blockTitle) {
            return blockLabels._blockTitle;
        }

        // PRIORITY 2: Generic formatting from key name
        // Remove common suffixes like _Block, _List, -Block
        let title = key
            .replace(/[_-](Block|List|Group|Section|Container)$/i, '')
            .replace(/[_-]/g, ' ');

        // Add spaces before capital letters (camelCase to Title Case)
        title = title.replace(/([a-z])([A-Z])/g, '$1 $2');

        // Capitalize first letter of each word
        title = title.replace(/\b\w/g, l => l.toUpperCase());

        return title.trim() || key;
    }

    /**
     * @description Get keys from a labels object sorted by _order (ascending).
     * Keys with _order use that value; keys without use 999 so they follow ordered items.
     * Ties and missing _order preserve original key order for stable display.
     * @param {object} labelsObj - Label object (section, block, or item labels)
     * @returns {string[]} Keys in display order (excluding keys starting with '_')
     */
    getOrderedKeys(labelsObj) {
        if (!labelsObj || typeof labelsObj !== 'object') return [];
        const keys = Object.keys(labelsObj).filter(k => !k.startsWith('_'));
        const withOrder = keys.map((k, i) => {
            const info = labelsObj[k];
            const order = (typeof info === 'object' && info !== null && typeof info._order === 'number')
                ? info._order
                : 999;
            return { key: k, order, index: i };
        });
        withOrder.sort((a, b) => a.order !== b.order ? a.order - b.order : a.index - b.index);
        return withOrder.map(x => x.key);
    }

    /**
     * @description Get keys for block content in display order.
     * If blockLabels._fieldOrder is an array, use that order (then append any keys not listed).
     * Otherwise use getOrderedKeys (sort by _order on each key).
     * @param {object} blockLabels - Block label object (may have _fieldOrder)
     * @returns {string[]} Keys in display order
     */
    getBlockContentKeys(blockLabels) {
        if (!blockLabels || typeof blockLabels !== 'object') return [];
        const fieldOrder = blockLabels._fieldOrder;
        if (Array.isArray(fieldOrder) && fieldOrder.length > 0) {
            const ordered = fieldOrder.filter(k => typeof k === 'string' && !k.startsWith('_') && blockLabels[k] != null);
            const rest = Object.keys(blockLabels).filter(k => !k.startsWith('_') && !ordered.includes(k));
            return [...ordered, ...rest];
        }
        return this.getOrderedKeys(blockLabels);
    }

    /**
     * @description Get keys in document order (as they appear in the label JSON / object).
     * Use within blocks so field and nested-block order matches the label JSON exactly.
     * @param {object} labelsObj - Label object (block or item labels)
     * @returns {string[]} Keys in source order (excluding keys starting with '_')
     */
    getKeysInDocumentOrder(labelsObj) {
        if (!labelsObj || typeof labelsObj !== 'object') return [];
        return Object.keys(labelsObj).filter(k => !k.startsWith('_'));
    }

    /**
     * @description Check if value is a plain object
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * @description Toggle section expansion
     */
    handleSectionToggle(event) {
        const sectionId = event.currentTarget.dataset.sectionId;
        this.toggleSection(sectionId);
    }

    /**
     * @description Handle keyboard navigation for section toggle
     */
    handleSectionKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const sectionId = event.currentTarget.dataset.sectionId;
            this.toggleSection(sectionId);
        }
    }

    /**
     * @description Toggle a section's expanded state
     */
    toggleSection(sectionId) {
        this.processedSections = this.processedSections.map(section => {
            if (section.id === sectionId) {
                const newExpanded = !section.isExpanded;
                return {
                    ...section,
                    isExpanded: newExpanded,
                    chevronIcon: newExpanded ? 'utility:chevrondown' : 'utility:chevronright'
                };
            }
            return section;
        });
    }

    /**
     * @description Check if content should be shown (not loading, no error)
     */
    get showContent() {
        return !this.isLoading && !this.hasError;
    }

    /**
     * @description Check if there are any sections to display
     */
    get hasSections() {
        return this.processedSections && this.processedSections.length > 0;
    }

    /**
     * @description Get the chevron icon based on section state
     */
    getChevronIcon(isExpanded) {
        return isExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    // ============================ Edit Mode Handlers ============================

    /**
     * @description Prevent clicks on Edit/Save/Cancel buttons from toggling the
     * section collapse (the whole header is a button with onclick={handleSectionToggle}).
     */
    handleActionClick(event) {
        event.stopPropagation();
    }

    handleEditSection(event) {
        event.stopPropagation();
        const sectionId = event.currentTarget.dataset.sectionId;
        if (!sectionId) return;
        // Deep clone the current section slice so edits are isolated until Save.
        const current = this._formData ? this._formData[sectionId] : null;
        this._drafts[sectionId] = this._deepClone(current && typeof current === 'object' ? current : {});
        this._editingSections.add(sectionId);
        this.processFormData();
    }

    handleCancelSection(event) {
        event.stopPropagation();
        const sectionId = event.currentTarget.dataset.sectionId;
        if (!sectionId) return;
        this._editingSections.delete(sectionId);
        delete this._drafts[sectionId];
        this.processFormData();
    }

    handleSaveSection(event) {
        event.stopPropagation();
        const sectionId = event.currentTarget.dataset.sectionId;
        if (!sectionId) return;

        const draft = this._drafts[sectionId];
        const committed = draft === undefined ? {} : draft;

        // Update local _formData so the UI immediately reflects the saved state.
        this._formData = { ...(this._formData || {}), [sectionId]: committed };

        // Persist back to OmniScript's data JSON.
        // Pass the FULL merged root (not just the delta) because OmniScript's
        // omniUpdateDataJson performs a shallow top-level replace — passing only
        // { [sectionId]: ... } would wipe sibling sections in some runtimes.
        // We also call omniApplyCallResp so the stepper / prior steps stay in sync.
        const root = this.omniJsonData;
        const payload = (root && typeof root === 'object' && !Array.isArray(root))
            ? { ...root, [sectionId]: committed }
            : { [sectionId]: committed };

        let dispatched = false;
        if (typeof this.omniApplyCallResp === 'function') {
            this.omniApplyCallResp(payload);
            dispatched = true;
        }
        if (typeof this.omniUpdateDataJson === 'function') {
            this.omniUpdateDataJson(payload);
            dispatched = true;
        }
        if (!dispatched) {
            // Fallback for environments without the mixin wired up.
            this.dispatchEvent(new CustomEvent('omniupdatedatajson', {
                detail: payload,
                bubbles: true,
                composed: true
            }));
        }

        this._editingSections.delete(sectionId);
        delete this._drafts[sectionId];
        this.processFormData();
    }

    /**
     * @description Write user input into the draft for the owning section.
     * Triggered by lightning-input onchange. We avoid calling processFormData here
     * so the input retains focus between keystrokes.
     */
    handleFieldChange(event) {
        const pathJson = event.currentTarget.dataset.path;
        const fieldType = event.currentTarget.dataset.type;
        if (!pathJson) return;
        let path;
        try {
            path = JSON.parse(pathJson);
        } catch (e) {
            return;
        }
        if (!Array.isArray(path) || path.length < 2) return;

        const sectionId = path[0];
        if (!this._editingSections.has(sectionId)) return;

        const detail = event.detail || {};
        let value;
        if (fieldType === 'boolean') {
            value = detail.checked === true;
        } else if (fieldType === 'number' || fieldType === 'currency') {
            // lightning-input emits strings; coerce to number when non-empty.
            const raw = detail.value;
            value = raw === '' || raw == null ? null : Number(raw);
            if (Number.isNaN(value)) value = raw; // preserve user-visible text if not numeric
        } else {
            value = detail.value == null ? '' : detail.value;
        }

        if (!this._drafts[sectionId] || typeof this._drafts[sectionId] !== 'object') {
            this._drafts[sectionId] = {};
        }
        this._setAtPath(this._drafts[sectionId], path.slice(1), value);
    }

    handleAddRow(event) {
        event.stopPropagation();
        const arrayPathJson = event.currentTarget.dataset.arrayPath;
        const schemaJson = event.currentTarget.dataset.rowSchema;
        if (!arrayPathJson) return;
        let arrayPath;
        let schemaKeys = [];
        try {
            arrayPath = JSON.parse(arrayPathJson);
            if (schemaJson) schemaKeys = JSON.parse(schemaJson);
        } catch (e) {
            return;
        }
        if (!Array.isArray(arrayPath) || arrayPath.length < 2) return;
        const sectionId = arrayPath[0];
        if (!this._editingSections.has(sectionId)) return;

        if (!this._drafts[sectionId] || typeof this._drafts[sectionId] !== 'object') {
            this._drafts[sectionId] = {};
        }
        const existing = this._getAtPath(this._drafts[sectionId], arrayPath.slice(1));
        const list = Array.isArray(existing) ? existing.slice() : [];
        list.push(this._buildEmptyRow(schemaKeys, list[0]));
        this._setAtPath(this._drafts[sectionId], arrayPath.slice(1), list);
        this.processFormData();
    }

    handleDeleteRow(event) {
        event.stopPropagation();
        const arrayPathJson = event.currentTarget.dataset.arrayPath;
        const rowIndexStr = event.currentTarget.dataset.rowIndex;
        if (!arrayPathJson || rowIndexStr == null) return;
        let arrayPath;
        try {
            arrayPath = JSON.parse(arrayPathJson);
        } catch (e) {
            return;
        }
        const rowIndex = Number(rowIndexStr);
        if (!Array.isArray(arrayPath) || arrayPath.length < 2 || Number.isNaN(rowIndex)) return;

        const sectionId = arrayPath[0];
        if (!this._editingSections.has(sectionId)) return;

        const existing = this._getAtPath(this._drafts[sectionId] || {}, arrayPath.slice(1));
        if (!Array.isArray(existing)) return;
        const list = existing.slice();
        if (rowIndex < 0 || rowIndex >= list.length) return;
        list.splice(rowIndex, 1);
        this._setAtPath(this._drafts[sectionId], arrayPath.slice(1), list);
        this.processFormData();
    }

    // ============================ Path / Clone helpers ============================

    _deepClone(obj) {
        if (obj == null) return obj;
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            return obj;
        }
    }

    _getAtPath(root, path) {
        let cur = root;
        for (const seg of path) {
            if (cur == null) return undefined;
            cur = cur[seg];
        }
        return cur;
    }

    _setAtPath(root, path, value) {
        if (!path || path.length === 0) return;
        let cur = root;
        for (let i = 0; i < path.length - 1; i++) {
            const seg = path[i];
            const nextSeg = path[i + 1];
            const needsArray = typeof nextSeg === 'number';
            if (cur[seg] == null || typeof cur[seg] !== 'object') {
                cur[seg] = needsArray ? [] : {};
            }
            cur = cur[seg];
        }
        cur[path[path.length - 1]] = value;
    }

    _buildEmptyRow(schemaKeys, template) {
        const row = {};
        if (template && typeof template === 'object') {
            // Preserve shape/keys; reset scalar values to empty, arrays/objects to empty copies.
            for (const k of Object.keys(template)) {
                const v = template[k];
                if (Array.isArray(v)) row[k] = [];
                else if (v && typeof v === 'object') row[k] = {};
                else if (typeof v === 'boolean') row[k] = false;
                else if (typeof v === 'number') row[k] = null;
                else row[k] = '';
            }
        }
        if (Array.isArray(schemaKeys)) {
            for (const k of schemaKeys) {
                if (!(k in row)) row[k] = '';
            }
        }
        return row;
    }
}
