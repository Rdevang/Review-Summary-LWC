global with sharing class GrantsBudgetController implements omnistudio.VlocityOpenInterface {

    global Boolean invokeMethod(String methodName, Map<String,Object> inputMap, Map<String,Object> outMap, Map<String,Object> options){
        
        if(methodName == 'getBudgetDetail'){
            String data = getBudgets((String)inputMap.get('proposal'));
            outMap.put('budgetInfo', data);
        }
        if(methodName == 'upsertLineItem'){
            String data = upsertLineItem((String)options.get('lineitem'));
            outMap.put('recordId', data);
        }
        if(methodName == 'deleteLineItem'){
            deleteLineItem((String)options.get('lineitem'));
        }
        return true;
    }

    @AuraEnabled
    public static String upsertLineItem(String budgetLineItem){
        Budget_Line_Item__c bliToUpdate = (Budget_Line_Item__c)JSON.deserialize(budgetLineItem, Budget_Line_Item__c.class);

        Map<String, Object> bliMap = new Map<String, Object>( bliToUpdate.getPopulatedFieldsAsMap() );

        // Step 3. Remove any fields you don't want
        bliMap.remove( 'Total_Budget__c' );

        if(bliMap.containsKey('Id')){
            bliMap.remove( 'Budget__c' );
        }

        // Step 4. Convert the map into sobject using the good ol' serialize/deserialize trick
        bliToUpdate = (Budget_Line_Item__c) JSON.deserialize( JSON.serialize( bliMap ), Budget_Line_Item__c.class );

        SObjectAccessDecision decision ;
        if(!bliMap.containsKey('Id')){
            decision = GrantsUtility.getAccessibleData(GrantsLiteralConstant.BUDGET_LINE_ITEM_SOBJECT_API, new List<Budget_Line_Item__c>{bliToUpdate},GrantsLiteralConstant.DML_INSERT,true);
            insert decision.getRecords();
        } else{
            decision = GrantsUtility.getAccessibleData(GrantsLiteralConstant.BUDGET_LINE_ITEM_SOBJECT_API, new List<Budget_Line_Item__c>{bliToUpdate},GrantsLiteralConstant.DML_UPDATE,true);
            update decision.getRecords();
        }
        return decision.getRecords()[0].Id;
    }
    @AuraEnabled
    public static void deleteLineItem(String budgetLineItem){
        delete (Budget_Line_Item__c)JSON.deserialize(budgetLineItem, Budget_Line_Item__c.class);
    }

    @AuraEnabled
    public static String getBudgets(Id recordId){
        try {
            Proposal__c proposal = [SELECT ID,Status__c FROM Proposal__c WHERE Id=:recordId];
            List<Budget__c> budgetList = [SELECT Id, Name, Total_Grant_Funded__c, Total_Match_Funds__c, Budget_Template__c,Proposal__c, Proposal__r.GrantSolicitation__c,
                                    Total_Match_Percent_Calculated__c, Total_Match_Percent_Required__c, Total_Other_Funds__c, Total_Budgeted__c,Proposal__r.GrantSolicitation__r.Match_Required__c,
                                    (SELECT Id, Name, Description__c, Grant_Funded__c, Match_Funds__c, Match_Percent_Calculated__c,
                                    Match_Percent_Required__c, Other_Funds__c, Total_Budget__c FROM Budget_Line_Items__r ORDER BY Name) FROM Budget__c
                                    WHERE Proposal__c = :recordId WITH SECURITY_ENFORCED];
            Map<Id, List<Budget__c>> mapOfBudgetTemplateIdToBudgetList = new Map<Id,List<Budget__c>>();
            for(Budget__c budget : budgetList){
                if(mapOfBudgetTemplateIdToBudgetList.containsKey(budget.Budget_Template__c)){
                    List<Budget__c> budgetL = mapOfBudgetTemplateIdToBudgetList.get(budget.Budget_Template__c);
                    budgetL.add(budget);
                    mapOfBudgetTemplateIdToBudgetList.put(budget.Budget_Template__c , budgetL);
                } else{
                    mapOfBudgetTemplateIdToBudgetList.put(budget.Budget_Template__c, new List<Budget__c>{budget});
                }
            }
            Map<Id, Budget_Template__c> mapOfBudgetTemplate = new Map<Id, Budget_Template__c>([SELECT ID,Budget_Template_Type__c FROM Budget_Template__c WHERE ID IN :mapOfBudgetTemplateIdToBudgetList.keySet() WITH SECURITY_ENFORCED]);
            Map<Budget_Template__c, List<Budget__c>> mapOfBudgetTemplateToBudgetList = new Map<Budget_Template__c, List<Budget__c>>();
            for(Budget_Template__c budgetTemplate : mapOfBudgetTemplate.values()){
                mapOfBudgetTemplateToBudgetList.put(budgetTemplate, mapOfBudgetTemplateIdToBudgetList.get(budgetTemplate.Id));
            }

            List<BudgetWrapper> budgetWrapperList = new List<BudgetWrapper>();
            for(Budget_Template__c template : mapOfBudgetTemplateToBudgetList.keyset()){
                BudgetWrapper wrapper = new BudgetWrapper();
                wrapper.templateName = template.Budget_Template_Type__c;
                wrapper.templateId = template.Id;
                wrapper.budgetList = mapOfBudgetTemplateIdToBudgetList.get(template.Id);
                wrapper.isActionAvailable = (proposal.Status__c == GrantsLiteralConstant.PROPOSAL_STATUS_DRAFT || proposal.Status__c == GrantsLiteralConstant.PROPOSAL_STATUS_ASSIGN_BACK) ? true : false;
                budgetWrapperList.add(wrapper);
            }

            return JSON.serialize(budgetWrapperList);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }


    public class BudgetWrapper{
        @AuraEnabled public String templateName;
        @AuraEnabled public String templateId;
        @AuraEnabled public Boolean isActionAvailable;
        @AuraEnabled public List<Budget__c> budgetList;
    }
}