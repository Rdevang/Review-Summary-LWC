import { LightningElement, api, track } from 'lwc';

/**
 * Config-driven synthetic sections. Budget step: embed c-budget-display-read-only (same omnistudio namespace; fetches via OmniScript action).
 * Document step: embed c-document-display-read-only (same pattern).
 */
const SECTION_CONFIG = {
    BudgetStep: {
        order: 4.5,
        isVisible: false,
        sectionTitle: 'Budget Review',
        recordIdFields: ['recordId', 'proposalId', 'ProposalId', 'proposalID', 'Proposal__c', 'proposal__c'],
        recordPageObject: 'Proposal__c'
    },
    DocumentStep: {
        order: 4.6,
        isVisible: false,
        sectionTitle: 'Document Review',
        recordIdFields: ['recordId', 'proposalId', 'ProposalId', 'proposalID', 'Proposal__c', 'proposal__c'],
        recordPageObject: 'Proposal__c'
    }
};

/**
 * @description Utility LWC to display Review and Summary for intake forms
 *              Works on record pages and as custom LWC inside OmniStudio
 *              Handles nested objects and arrays dynamically
 */
export default class IntakeFormReviewSummary extends LightningElement {

    // OmniScript data - received when used as Custom LWC in OmniStudio
    @api omniJsonData;

    // API properties for use on record pages
    @api formData;
    @api labelData;
    @api title = '';
    @api hideEmptyFields = false;
    @api collapsibleSections = false;

    // Configurable fields to skip (comma-separated string or array)
    @api
    get skipFieldsList() {
        return this._skipFields.join(',');
    }
    set skipFieldsList(value) {
        if (typeof value === 'string') {
            this._skipFields = value.split(',').map(f => f.trim()).filter(f => f);
        } else if (Array.isArray(value)) {
            this._skipFields = value;
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

    // Default fields to skip (can be overridden via skipFieldsList)
    _skipFields = [];

    _lastOmniDataHash = null;
    _isInitialized = false;

    connectedCallback() {
        if (this.omniJsonData || this.formData) {
            this.initializeData();
        }
    }

    /**
     * @description Re-initialize when omniJsonData changes (OmniScript navigation)
     *              Also handles initial data arrival in OmniScript Preview
     */
    renderedCallback() {
        // Handle initial data arrival or data changes
        if (this.omniJsonData) {
            const currentHash = JSON.stringify(this.omniJsonData);
            if (this._lastOmniDataHash !== currentHash) {
                this._lastOmniDataHash = currentHash;
                this.initializeData();
            }
        } else if (!this._isInitialized && this.formData) {
            this.initializeData();
        }
    }

    /**
     * @description Initialize data from either API properties or OmniScript
     */
    initializeData() {
        // Reset state on each initialization attempt
        this.hasError = false;
        this.errorMessage = '';
        this.isLoading = true;
        this._isInitialized = true;

        try {
            // Try to get data from OmniScript first
            if (this.omniJsonData) {

                // OmniStudio passes data in different ways:
                // 1. As specific properties: formData, labelData
                // 2. As the entire JSON data (form values are in the root)
                // 3. As a specific step/node

                this._formData = this.omniJsonData.formData
                    || this.omniJsonData.reviewData
                    || this.omniJsonData;

                // Get label data - may be string or object
                let labelSource = this.omniJsonData.labelData
                    || this.omniJsonData.labels
                    || this.omniJsonData.fieldLabels
                    || {};

                // Parse if labelData is a string (from Set Values with quoted JSON)
                if (typeof labelSource === 'string') {
                    try {
                        this._labelData = JSON.parse(labelSource);
                    } catch (e) {
                        console.warn('Failed to parse labelData string:', e);
                        this._labelData = {};
                    }
                } else {
                    this._labelData = labelSource;
                }
            }

            // Override with API properties if provided (for Record Page usage)
            if (this.formData) {
                this._formData = typeof this.formData === 'string'
                    ? JSON.parse(this.formData)
                    : this.formData;
            }

            if (this.labelData) {
                this._labelData = typeof this.labelData === 'string'
                    ? JSON.parse(this.labelData)
                    : this.labelData;
            }

            if (this._formData) {
                this.processFormData();
            } else {
                this.hasError = true;
                this.errorMessage = 'No form data provided.';
            }

            this.isLoading = false;
        } catch (error) {
            console.error('Error initializing data:', error);
            this.hasError = true;
            this.errorMessage = 'Error processing form data: ' + error.message;
            this.isLoading = false;
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

            let value = this._formData[key];
            const labelInfo = this._labelData[key];

            // Skip if labelInfo is not a section (e.g. internal keys)
            if (!labelInfo || typeof labelInfo !== 'object') continue;

            // Parse JSON string if the value is a string (from Long Text Area fields)
            if (typeof value === 'string') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    console.warn(`Failed to parse JSON for section ${key}:`, e);
                    value = undefined;
                }
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
        for (const [sectionId, config] of Object.entries(SECTION_CONFIG)) {
            if (!config.isVisible) continue;
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
                blocks: [],
                fields: [],
                hasFields: false,
                hasBlocks: false
            });
        }
        return out;
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

        const section = {
            id: sectionKey,
            title: sectionTitle,
            contentId: `content-${sectionKey}`,
            isExpanded: true,
            chevronIcon: 'utility:chevrondown',
            blocks: [],
            fields: []
        };

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
                const arrayBlock = this.processArray(key, value, labelInfo);
                if (arrayBlock) {
                    section.blocks.push(arrayBlock);
                }
            } else if (this.isObject(value)) {
                // It's a nested block (needs _blockTitle or field labels)
                const block = this.processBlock(key, value, labelInfo);
                if (block) {
                    section.blocks.push(block);
                }
            } else {
                // It's a simple field - labelInfo can be string or object with label/type
                const isValidLabel = typeof labelInfo === 'string' ||
                    (typeof labelInfo === 'object' && labelInfo.label);
                if (isValidLabel) {
                    const field = this.processField(key, value, labelInfo);
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
    processBlock(blockKey, blockData, blockLabels) {
        // Block must have labels defined (either _blockTitle or field labels)
        if (!blockLabels || typeof blockLabels !== 'object') {
            return null;
        }

        const blockTitle = this.formatBlockTitle(blockKey, blockLabels);
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
                    const nestedBlock = this.processBlock(key, value, labelInfo);
                    if (nestedBlock) {
                        if (nestedBlock.isAddressBlock) {
                            // Show address as a normal field in the grid (half width unless _addressColspan in label JSON)
                            const addressField = this.makeAddressField(key, nestedBlock.title, nestedBlock.fullAddressValue, labelInfo);
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
                    const field = this.processField(key, value, labelInfo);
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

        // Address blocks: keep only Full Address value; show as "Applicant Address" + value (no "Full Address" label)
        if (this.isAddressBlock(blockKey, blockLabels)) {
            const fullAddressField = block.fields.find(f => f.label === 'Full Address');
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
    makeAddressField(key, label, displayValue, blockLabels) {
        const colspan = (blockLabels && typeof blockLabels._addressColspan === 'number')
            ? Math.min(Math.max(blockLabels._addressColspan, 1), 12)
            : 6;
        return {
            id: key,
            key: key,
            label: label,
            value: displayValue,
            displayValue: displayValue || '—',
            fieldType: 'text',
            isBoolean: false,
            isMultiSelect: false,
            displayValues: [],
            colspan: colspan,
            spanClass: `field-item span-${colspan}`
        };
    }

    /**
     * @description Process an array as a repeatable block with items
     * Only includes fields that have labels defined
     * IMPORTANT: Iterates over itemLabels keys to preserve JSON order
     */
    processArray(arrayKey, arrayData, arrayLabels) {
        if (!arrayData || arrayData.length === 0 || !arrayLabels) {
            return null;
        }

        // Get item labels - supports both object format and array format
        const itemLabels = typeof arrayLabels === 'object' && !Array.isArray(arrayLabels)
            ? arrayLabels
            : (Array.isArray(arrayLabels) && arrayLabels.length > 0 ? arrayLabels[0] : null);

        if (!itemLabels) {
            return null;
        }

        const block = {
            id: arrayKey,
            title: (itemLabels && itemLabels._blockTitle) || this.formatBlockTitle(arrayKey, itemLabels),
            isBlock: true,
            isArray: true,
            items: [],
            columns: []
        };

        // Get label keys in document order (same as label JSON) for column/field order
        const labelKeys = this.getKeysInDocumentOrder(itemLabels);

        // Process each item in the array
        arrayData.forEach((item, index) => {
            const processedItem = {
                id: `${arrayKey}_${index}`,
                index: index + 1,
                fields: []
            };

            // Iterate over itemLabels keys to preserve the order defined in JSON
            for (const key of labelKeys) {
                const value = item[key];
                const labelInfo = itemLabels[key];

                // Skip if no corresponding data exists
                if (value === undefined) continue;

                // Only include fields with valid labels (string or object with label)
                const isValidLabel = typeof labelInfo === 'string' ||
                    (typeof labelInfo === 'object' && labelInfo.label);
                if (!isValidLabel) continue;

                const field = this.processField(key, value, labelInfo);

                if (field && (!this.hideEmptyFields || field.displayValue !== '—')) {
                    processedItem.fields.push(field);

                    // Add to columns for table header (only once)
                    if (index === 0) {
                        block.columns.push({
                            label: field.label,
                            fieldName: key
                        });
                    }
                }
            }

            if (processedItem.fields.length > 0) {
                block.items.push(processedItem);
            }
        });

        return block.items.length > 0 ? block : null;
    }

    /**
     * @description Process a single field
     * @param {string} key - Field key
     * @param {*} value - Field value
     * @param {string|object} labelInfo - Label from labelData. Can be:
     *   - String: "Label Text" (auto-detect type)
     *   - Object: { "label": "Label Text", "type": "phone|email|currency|date|boolean|number", "colspan": 1-12 }
     */
    processField(key, value, labelInfo) {
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
            spanClass: `field-item span-${colspan}`
        };
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
     * @description Check if title is provided (non-empty)
     */
    get hasTitle() {
        return this.title && this.title.trim().length > 0;
    }

    /**
     * @description Get the chevron icon based on section state
     */
    getChevronIcon(isExpanded) {
        return isExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }
}