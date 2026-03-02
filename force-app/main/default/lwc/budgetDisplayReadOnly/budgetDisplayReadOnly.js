import { LightningElement, api, track } from 'lwc';
import { OmniscriptActionCommonUtil } from 'omnistudio/omniscriptActionUtils';

/**
 * Read-only budget display. Fetches budget via OmniscriptActionCommonUtil (no @salesforce/apex)
 * so it works with runtimeNamespace omnistudio. Pass recordId (proposal id) to load data.
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

    get displayData() {
        return this._displayData;
    }
    get showError() {
        return this._showError;
    }

    connectedCallback() {
        this._actionUtil = new OmniscriptActionCommonUtil();
        if (this.recordId) {
            this.getBudgetDetails();
        }
    }

    getBudgetDetails() {
        if (!this.recordId || !this._actionUtil) return;
        const params = {
            input: JSON.stringify({ proposal: this.recordId }),
            sClassName: 'GrantsBudgetController',
            sMethodName: 'getBudgetDetail',
            options: '{}'
        };
        this._actionUtil
            .executeAction(params, null, this, null, null)
            .then((response) => {
                const raw = response && response.result && response.result.budgetInfo
                    ? JSON.parse(response.result.budgetInfo)
                    : [];
                this._displayData = Array.isArray(raw) && raw.length ? this.processBudgetData(raw) : [];
                this._showError = !this._displayData || this._displayData.length === 0;
            })
            .catch((err) => {
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