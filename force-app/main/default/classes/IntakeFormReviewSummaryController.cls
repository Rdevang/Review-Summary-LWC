/**
 * Controller for Intake Form Review Summary and related LWCs (e.g. budget display).
 * Implements OmniStudio VlocityOpenInterface so OmniScript/LWC can call via OmniscriptActionCommonUtil.
 */
global with sharing class IntakeFormReviewSummaryController implements omnistudio.VlocityOpenInterface {

    global Boolean invokeMethod(String methodName, Map<String, Object> inputMap, Map<String, Object> outMap, Map<String, Object> options) {
        if (methodName == 'getBudgetDetail') {
            String proposalId = (String) inputMap.get('proposal');
            String data = getBudgets(proposalId);
            outMap.put('budgetInfo', data);
        }
        if (methodName == 'getDocumentDetail') {
            String proposalId = (String) inputMap.get('proposal');
            String data = GrantsDocumentUploadController.getAllDocuments(proposalId);
            outMap.put('documents', data);
        }
        return true;
    }

    /**
     * Returns serialized budget wrappers for the given Proposal Id.
     * Used by budgetDisplayReadOnly LWC.
     */
    @AuraEnabled(cacheable=false)
    public static String getBudgets(String proposalId) {
        if (String.isBlank(proposalId)) {
            throw new AuraHandledException('Proposal Id is required.');
        }
        Id recordId;
        try {
            recordId = Id.valueOf(proposalId.trim());
        } catch (Exception e) {
            throw new AuraHandledException('Invalid Proposal Id.');
        }

        List<Proposal__c> proposals = [
            SELECT Id, Status__c
            FROM Proposal__c
            WHERE Id = :recordId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (proposals.isEmpty()) {
            throw new AuraHandledException('Proposal not found or you do not have access to it.');
        }
        Proposal__c proposal = proposals[0];

        List<Budget__c> budgetList = [
            SELECT Id, Name, Total_Grant_Funded__c, Total_Match_Funds__c, Budget_Template__c, Proposal__c,
                Proposal__r.GrantSolicitation__c, Total_Match_Percent_Calculated__c, Total_Match_Percent_Required__c,
                Total_Other_Funds__c, Total_Budgeted__c, Proposal__r.GrantSolicitation__r.Match_Required__c,
                (SELECT Id, Name, Description__c, Grant_Funded__c, Match_Funds__c, Match_Percent_Calculated__c,
                    Match_Percent_Required__c, Other_Funds__c, Total_Budget__c
                FROM Budget_Line_Items__r
                ORDER BY Name)
            FROM Budget__c
            WHERE Proposal__c = :recordId
            WITH SECURITY_ENFORCED
        ];

        Map<Id, List<Budget__c>> mapOfBudgetTemplateIdToBudgetList = new Map<Id, List<Budget__c>>();
        for (Budget__c budget : budgetList) {
            Id templateId = budget.Budget_Template__c;
            if (mapOfBudgetTemplateIdToBudgetList.containsKey(templateId)) {
                mapOfBudgetTemplateIdToBudgetList.get(templateId).add(budget);
            } else {
                mapOfBudgetTemplateIdToBudgetList.put(templateId, new List<Budget__c>{ budget });
            }
        }

        if (mapOfBudgetTemplateIdToBudgetList.isEmpty()) {
            return JSON.serialize(new List<BudgetWrapper>());
        }

        Map<Id, Budget_Template__c> mapOfBudgetTemplate = new Map<Id, Budget_Template__c>([
            SELECT Id, Budget_Template_Type__c
            FROM Budget_Template__c
            WHERE Id IN :mapOfBudgetTemplateIdToBudgetList.keySet()
            WITH SECURITY_ENFORCED
        ]);

        Boolean isActionAvailable = isProposalEditable(proposal.Status__c);

        List<BudgetWrapper> budgetWrapperList = new List<BudgetWrapper>();
        for (Budget_Template__c template : mapOfBudgetTemplate.values()) {
            BudgetWrapper wrapper = new BudgetWrapper();
            wrapper.templateName = template.Budget_Template_Type__c;
            wrapper.templateId = template.Id;
            wrapper.budgetList = mapOfBudgetTemplateIdToBudgetList.get(template.Id);
            wrapper.isActionAvailable = isActionAvailable;
            budgetWrapperList.add(wrapper);
        }

        return JSON.serialize(budgetWrapperList);
    }

    private static Boolean isProposalEditable(String status) {
        if (String.isBlank(status)) return false;
        String s = status.trim().toLowerCase();
        return s == 'draft' || s == 'assign back';
    }

    public class BudgetWrapper {
        @AuraEnabled public String templateName;
        @AuraEnabled public String templateId;
        @AuraEnabled public Boolean isActionAvailable;
        @AuraEnabled public List<Budget__c> budgetList;
    }
}
