import { LightningElement, api, track } from 'lwc';
import { OmniscriptActionCommonUtil } from 'omnistudio/omniscriptActionUtils';

/**
 * Read-only budget display. Fetches budget via OmniscriptActionCommonUtil (no @salesforce/apex)
 * so it works with runtimeNamespace omnistudio. Uses IntakeFormReviewSummaryController.getBudgetDetail.
 * Pass recordId (proposal id) or it is read from URL param c__proposal.
 */
export default class BudgetDisplayReadOnly extends LightningElement {
    _recordId;

    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        if (value && this._actionUtil) this.getBudgetDetails();
    }

    _actionUtil;
    @track _displayData = [];
    _showError = false;
    _errorMessage = '';

    get displayData() {
        return this._displayData;
    }
    get showError() {
        return this._showError;
    }
    get errorMessage() {
        return this._errorMessage;
    }

    connectedCallback() {
        this._actionUtil = new OmniscriptActionCommonUtil();
        if (!this._recordId || this._recordId === '') {
            const urlParams = new URLSearchParams(window.location.search);
            const proposalId = urlParams.get('c__proposal');
            if (proposalId) this._recordId = proposalId.trim();
        }
        if (this._recordId) {
            this.getBudgetDetails();
        }
    }

    getBudgetDetails() {
        if (!this.recordId || !this._actionUtil) return;
        const params = {
            input: JSON.stringify({ proposal: this.recordId }),
            sClassName: 'IntakeFormReviewSummaryController',
            sMethodName: 'getBudgetDetail',
            options: '{}'
        };
        this._actionUtil
            .executeAction(params, null, this, null, null)
            .then((response) => {
                const result = response && response.result;
                const budgetInfoStr = result && result.budgetInfo;
                const raw = budgetInfoStr ? JSON.parse(budgetInfoStr) : [];
                this._displayData = Array.isArray(raw) && raw.length ? this.processBudgetData(raw) : [];
                this._showError = !this._displayData || this._displayData.length === 0;
                if (this._showError) {
                    this._errorMessage = (result && (result.error || result.message)) || 'No budget data found.';
                    console.log('budgetDisplayReadOnly errorMessage:', this._errorMessage);
                    if (!budgetInfoStr || (Array.isArray(raw) && raw.length === 0)) {
                        console.log('budgetDisplayReadOnly response.result:', JSON.stringify(result));
                    }
                } else {
                    this._errorMessage = '';
                }
            })
            .catch((err) => {
                this._errorMessage = (err && (err.message || err.body?.message)) || String(err);
                console.log('budgetDisplayReadOnly errorMessage:', this._errorMessage);
                console.error('Budget load error:', err);
                this._displayData = [];
                this._showError = true;
            });
    }

    processBudgetData(data) {
        const raw = Array.isArray(data) ? data : [];
        if (!raw.length) return [];
        const tempData = JSON.parse(JSON.stringify(raw));
        tempData.forEach((row) => {
            row.totalGrantFunded = 0;
            row.totalMatchFunds = 0;
            row.totalOtherFunds = 0;
            row.totalBudgeted = 0;
            (row.budgetList || []).forEach((row1) => {
                if (!row1.Budget_Line_Items__r) row1.Budget_Line_Items__r = { records: [] };
                row.totalGrantFunded += Number(row1.Total_Grant_Funded__c) || 0;
                row.totalMatchFunds += Number(row1.Total_Match_Funds__c) || 0;
                row.totalOtherFunds += Number(row1.Total_Other_Funds__c) || 0;
                row.totalBudgeted += Number(row1.Total_Budgeted__c) || 0;
            });
        });
        return tempData;
    }
}