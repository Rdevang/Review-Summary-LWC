import { LightningElement, api, track } from 'lwc';
import { OmniscriptActionCommonUtil } from 'omnistudio/omniscriptActionUtils';

/**
 * Read-only document display. Fetches documents via OmniscriptActionCommonUtil (no @salesforce/apex)
 * so it works with runtimeNamespace omnistudio. Uses IntakeFormReviewSummaryController.getDocumentDetail.
 * Pass recordId (proposal id) or it is read from URL param c__proposal.
 */
export default class DocumentDisplayReadOnly extends LightningElement {
    _recordId;

    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        if (value && this._actionUtil) this.loadDocuments();
    }

    _actionUtil;
    @track _documents = [];
    _showError = false;
    _errorMessage = '';
    _isLoading = true;

    get documents() {
        return this._documents;
    }
    get showError() {
        return this._showError;
    }
    get errorMessage() {
        return this._errorMessage;
    }
    get isLoading() {
        return this._isLoading;
    }

    connectedCallback() {
        this._actionUtil = new OmniscriptActionCommonUtil();
        const urlParams = new URLSearchParams(window.location.search);
        const proposalId = urlParams.get('c__proposal');
        if (proposalId) this._recordId = proposalId.trim();
        if (this._recordId) this.loadDocuments();
        else this._isLoading = false;
    }

    loadDocuments() {
        if (!this.recordId || !this._actionUtil) {
            this._isLoading = false;
            return;
        }
        this._isLoading = true;
        this._showError = false;
        const params = {
            input: JSON.stringify({ proposal: this.recordId }),
            sClassName: 'IntakeFormReviewSummaryController',
            sMethodName: 'getDocumentDetail',
            options: '{}'
        };
        this._actionUtil
            .executeAction(params, null, this, null, null)
            .then((response) => {
                const result = response && response.result;
                const documentsStr = result && result.documents;
                let raw = [];
                try {
                    raw = documentsStr ? JSON.parse(documentsStr) : [];
                } catch (e) {
                    console.warn('documentDisplayReadOnly: failed to parse documents', e);
                }
                this._documents = Array.isArray(raw) ? this.enrichDocuments(raw) : [];
                this._showError = !this._documents || this._documents.length === 0;
                this._errorMessage = this._showError
                    ? (result && (result.error || result.message)) || 'No documents uploaded yet.'
                    : '';
                this._isLoading = false;
            })
            .catch((err) => {
                this._errorMessage = (err && (err.message || err.body?.message)) || String(err);
                console.error('Document load error:', err);
                this._documents = [];
                this._showError = true;
                this._isLoading = false;
            });
    }

    /**
     * Add latestVersionId to each doc for download link (contentVersionList ordered by VersionNumber DESC).
     */
    enrichDocuments(raw) {
        return raw.map((doc) => {
            const list = doc && doc.contentVersionList;
            const latestVersionId = Array.isArray(list) && list.length > 0 && list[0] ? list[0].Id : null;
            const docNoView = !doc.contentDocumentId && !latestVersionId;
            return { ...doc, latestVersionId, docNoView };
        });
    }

    handlePreview(event) {
        const contentDocumentId = event.target.dataset.contentdocumentid;
        if (contentDocumentId) {
            window.open('/sfc/servlet.shepherd/document/download/' + contentDocumentId);
        }
    }

    handleDownload(event) {
        const versionId = event.target.dataset.versionid;
        if (versionId) {
            window.open('/sfc/servlet.shepherd/version/download/' + versionId);
        }
    }
}
