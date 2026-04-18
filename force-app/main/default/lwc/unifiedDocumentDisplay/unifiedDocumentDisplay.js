import { LightningElement, api, track } from 'lwc';
import { OmniscriptActionCommonUtil } from 'omnistudio/omniscriptActionUtils';

/**
 * Unified read-only document list for both LPI and GRANTS org flavors.
 * Fetches via OmniScript action (IntakeFormReviewSummaryController.getDocuments) so it works
 * under runtimeNamespace omnistudio without @salesforce/apex.
 *
 * Required inputs:
 *   @api orgType   'LPI' | 'GRANTS'
 *   @api recordId  PAR/BLA Id for LPI, Proposal Id for GRANTS
 */
export default class UnifiedDocumentDisplay extends LightningElement {
    _orgType;
    _recordId;

    @api
    get orgType() { return this._orgType; }
    set orgType(value) {
        this._orgType = value ? String(value).trim() : value;
        this._loadIfReady();
    }

    @api
    get recordId() { return this._recordId; }
    set recordId(value) {
        this._recordId = value ? String(value).trim() : value;
        this._loadIfReady();
    }

    _actionUtil;
    @track _documents = [];
    _showError = false;
    _errorMessage = '';
    _isLoading = true;

    get documents() { return this._documents; }
    get showError() { return this._showError; }
    get errorMessage() { return this._errorMessage; }
    get isLoading() { return this._isLoading; }

    connectedCallback() {
        this._actionUtil = new OmniscriptActionCommonUtil();
        this._loadIfReady();
    }

    _loadIfReady() {
        if (this._actionUtil && this._orgType && this._recordId) {
            this.loadDocuments();
        } else if (!this._orgType || !this._recordId) {
            this._isLoading = false;
        }
    }

    loadDocuments() {
        this._isLoading = true;
        this._showError = false;

        const params = {
            input: JSON.stringify({
                orgType: this._orgType,
                recordId: this._recordId
            }),
            sClassName: 'IntakeFormReviewSummaryController',
            sMethodName: 'getDocuments',
            options: '{}'
        };

        this._actionUtil
            .executeAction(params, null, this, null, null)
            .then((response) => {
                const result = (response && response.result) || {};
                const documentsStr = result.documents;
                let raw = [];
                try {
                    raw = documentsStr ? JSON.parse(documentsStr) : [];
                } catch (e) {
                    raw = [];
                }
                this._documents = Array.isArray(raw) ? this._enrich(raw) : [];
                this._showError = this._documents.length === 0;
                this._errorMessage = this._showError
                    ? (result.error || result.message || 'No documents uploaded yet.')
                    : '';
                this._isLoading = false;
            })
            .catch((err) => {
                this._errorMessage = (err && (err.message || (err.body && err.body.message))) || String(err);
                this._documents = [];
                this._showError = true;
                this._isLoading = false;
            });
    }

    _enrich(raw) {
        return raw.map((doc) => {
            const hasContent = !!doc.contentDocumentId;
            const hasVersion = !!doc.latestVersionId;
            return {
                ...doc,
                docNoView: !hasContent && !hasVersion
            };
        });
    }

    handlePreview(event) {
        const contentDocumentId = event.currentTarget.dataset.contentdocumentid;
        if (contentDocumentId) {
            window.open('/sfc/servlet.shepherd/document/download/' + contentDocumentId);
        }
    }

    handleDownload(event) {
        const versionId = event.currentTarget.dataset.versionid;
        if (versionId) {
            window.open('/sfc/servlet.shepherd/version/download/' + versionId);
        }
    }
}