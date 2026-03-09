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
    _budgetRetryDone = false; // one retry for community first-load "Script-thrown exception"
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
        console.log('budgetDisplayReadOnly connectedCallback recordId:', this._recordId);
        const urlParams = new URLSearchParams(window.location.search);
        const proposalId = urlParams.get('c__proposal');
        if (proposalId) this._recordId = proposalId.trim();
        console.log('budgetDisplayReadOnly connectedCallback proposalId:', proposalId);
        if (this._recordId) this.getBudgetDetails();
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
                const errMsg = (result && (result.error || result.message)) || 'No budget data found.';

                // Community first-load often returns "Script-thrown exception"; retry once (like Previous/Next fixes it)
                if (this._showError && errMsg === 'Script-thrown exception' && !this._budgetRetryDone) {
                    this._budgetRetryDone = true;
                    this._showError = false;
                    this._errorMessage = '';
                    console.log('budgetDisplayReadOnly: Script-thrown exception on first load, retrying in 1.5s...');
                    setTimeout(() => {
                        this.getBudgetDetails();
                    }, 1500);
                    return;
                }

                if (this._showError) {
                    this._errorMessage = errMsg;
                } else {
                    this._errorMessage = '';
                }
            })
            .catch((err) => {
                this._errorMessage = (err && (err.message || err.body?.message)) || String(err);
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