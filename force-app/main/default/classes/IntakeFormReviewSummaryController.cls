/**
 * Controller for Intake Form Review Summary and related LWCs (budget + document display).
 * Combines LPI and GRANTS behavior in one class. All custom Apex and custom SObject
 * references are resolved dynamically (Database.query + Schema.getGlobalDescribe +
 * Type.forName / Callable) so this class compiles in any org and gracefully no-ops
 * whenever a required type is absent at runtime.
 *
 * Implements OmniStudio VlocityOpenInterface so OmniScript / Custom LWCs can call via
 * OmniscriptActionCommonUtil.
 *
 * Supported actions:
 *   getBudgetDetail   - GRANTS. Input: { proposal }. Output: { budgetInfo }.
 *   getDocumentDetail - GRANTS legacy. Input: { proposal }. Output: { documents } raw JSON
 *                       from GrantsDocumentUploadController (when present).
 *   getDocuments      - Unified LPI + GRANTS. Input: { orgType, recordId }. Output:
 *                       { documents } normalized DocumentWrapper JSON for
 *                       c-unified-document-display.
 */
global with sharing class IntakeFormReviewSummaryController implements omnistudio.VlocityOpenInterface {

    private static final String ORG_LPI = 'LPI';
    private static final String ORG_GRANTS = 'GRANTS';
    private static final String STATUS_SUBMITTED = 'Submitted';
    private static final String GRANTS_DOC_CTRL = 'GrantsDocumentUploadController';

    global Boolean invokeMethod(String methodName, Map<String, Object> inputMap, Map<String, Object> outMap, Map<String, Object> options) {
        try {
            if (methodName == 'getBudgetDetail') {
                String proposalId = (String) inputMap.get('proposal');
                outMap.put('budgetInfo', getBudgets(proposalId));
            } else if (methodName == 'getDocumentDetail') {
                String proposalId = (String) inputMap.get('proposal');
                outMap.put('documents', invokeGrantsLegacyDocs(proposalId));
            } else if (methodName == 'getDocuments') {
                String orgType = normalizeOrg((String) inputMap.get('orgType'));
                String recordId = (String) inputMap.get('recordId');
                outMap.put('documents', JSON.serialize(fetchDocuments(orgType, recordId)));
            }
        } catch (Exception e) {
            String msg = e instanceof AuraHandledException ? e.getMessage() : (e.getMessage() != null ? e.getMessage() : 'An error occurred.');
            outMap.put('error', msg);
            if (methodName == 'getBudgetDetail') {
                outMap.put('budgetInfo', '[]');
            } else if (methodName == 'getDocumentDetail' || methodName == 'getDocuments') {
                outMap.put('documents', '[]');
            }
        }
        return true;
    }

    // ================== Budget (GRANTS, dynamic) ==================

    /**
     * Returns serialized budget wrappers for the given Proposal Id. Uses dynamic SOQL so
     * the class still compiles in orgs that lack Proposal__c / Budget__c.
     */
    @AuraEnabled(cacheable=false)
    public static String getBudgets(String proposalId) {
        if (String.isBlank(proposalId)) {
            throw new AuraHandledException('Proposal Id is required.');
        }

        Map<String, Schema.SObjectType> describe = Schema.getGlobalDescribe();
        if (!describe.containsKey('Proposal__c') || !describe.containsKey('Budget__c') || !describe.containsKey('Budget_Template__c')) {
            return JSON.serialize(new List<BudgetWrapper>());
        }

        Id recordId;
        try {
            recordId = Id.valueOf(proposalId.trim());
        } catch (Exception e) {
            throw new AuraHandledException('Invalid Proposal Id.');
        }

        List<SObject> proposals = Database.query(
            'SELECT Id, Status__c FROM Proposal__c WHERE Id = :recordId WITH SECURITY_ENFORCED LIMIT 1'
        );
        if (proposals.isEmpty()) {
            throw new AuraHandledException('Proposal not found or you do not have access to it.');
        }
        SObject proposal = proposals[0];

        String budgetSoql =
            'SELECT Id, Name, Total_Grant_Funded__c, Total_Match_Funds__c, Budget_Template__c, Proposal__c, ' +
            'Proposal__r.GrantSolicitation__c, Total_Match_Percent_Calculated__c, Total_Match_Percent_Required__c, ' +
            'Total_Other_Funds__c, Total_Budgeted__c, Proposal__r.GrantSolicitation__r.Match_Required__c, ' +
            '(SELECT Id, Name, Description__c, Grant_Funded__c, Match_Funds__c, Match_Percent_Calculated__c, ' +
            'Match_Percent_Required__c, Other_Funds__c, Total_Budget__c FROM Budget_Line_Items__r ORDER BY Name) ' +
            'FROM Budget__c WHERE Proposal__c = :recordId WITH SECURITY_ENFORCED';
        List<SObject> budgetList = Database.query(budgetSoql);

        Map<Id, List<SObject>> mapOfBudgetTemplateIdToBudgetList = new Map<Id, List<SObject>>();
        for (SObject budget : budgetList) {
            Id templateId = (Id) budget.get('Budget_Template__c');
            if (mapOfBudgetTemplateIdToBudgetList.containsKey(templateId)) {
                mapOfBudgetTemplateIdToBudgetList.get(templateId).add(budget);
            } else {
                mapOfBudgetTemplateIdToBudgetList.put(templateId, new List<SObject>{ budget });
            }
        }

        if (mapOfBudgetTemplateIdToBudgetList.isEmpty()) {
            return JSON.serialize(new List<BudgetWrapper>());
        }

        Set<Id> templateIds = mapOfBudgetTemplateIdToBudgetList.keySet();
        List<SObject> templates = Database.query(
            'SELECT Id, Budget_Template_Type__c FROM Budget_Template__c WHERE Id IN :templateIds WITH SECURITY_ENFORCED'
        );

        Boolean isActionAvailable = isProposalEditable((String) proposal.get('Status__c'));

        List<BudgetWrapper> budgetWrapperList = new List<BudgetWrapper>();
        for (SObject template : templates) {
            BudgetWrapper wrapper = new BudgetWrapper();
            wrapper.templateName = (String) template.get('Budget_Template_Type__c');
            wrapper.templateId = String.valueOf(template.get('Id'));
            wrapper.budgetList = mapOfBudgetTemplateIdToBudgetList.get((Id) template.get('Id'));
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
        @AuraEnabled public List<SObject> budgetList;
    }

    // ================== Unified Documents (LPI + GRANTS) ==================

    private static String normalizeOrg(String raw) {
        return String.isBlank(raw) ? '' : raw.trim().toUpperCase();
    }

    private static Boolean isSubmitted(String status) {
        return String.isNotBlank(status) && status.equalsIgnoreCase(STATUS_SUBMITTED);
    }

    private static List<DocumentWrapper> fetchDocuments(String orgType, String recordId) {
        if (String.isBlank(recordId)) return new List<DocumentWrapper>();
        if (orgType == ORG_LPI) return fetchLpiDocuments(recordId);
        if (orgType == ORG_GRANTS) return fetchGrantsDocuments(recordId);
        return new List<DocumentWrapper>();
    }

    /**
     * LPI: documents for a PAR or BLA. `recordId` is matched against both lookups.
     * Child rows (Application_Document__c != NULL) are excluded. Uses dynamic SOQL and
     * generic SObject access so the class compiles in orgs without Application_Document__c.
     */
    private static List<DocumentWrapper> fetchLpiDocuments(String recordId) {
        List<DocumentWrapper> result = new List<DocumentWrapper>();
        if (!Schema.getGlobalDescribe().containsKey('Application_Document__c')) return result;

        String appDocSoql =
            'SELECT Id, Name, Document_Name__c, Status__c, Is_Document_Required__c, ' +
            'File_Name__c, Sequence__c, LastModifiedDate ' +
            'FROM Application_Document__c ' +
            'WHERE (Preliminary_Application_Reference__c = :recordId ' +
            'OR Business_License_Application__c = :recordId) ' +
            'AND Application_Document__c = NULL ' +
            'ORDER BY Sequence__c ASC';
        List<SObject> appDocs = Database.query(appDocSoql);
        if (appDocs == null || appDocs.isEmpty()) return result;

        Set<Id> appDocIds = new Set<Id>();
        for (SObject d : appDocs) appDocIds.add((Id) d.get('Id'));

        // Latest ContentDocumentId per Application_Document__c
        Map<Id, Id> appDocIdToContentDocId = new Map<Id, Id>();
        List<SObject> cdls = Database.query(
            'SELECT Id, ContentDocumentId, LinkedEntityId FROM ContentDocumentLink ' +
            'WHERE LinkedEntityId IN :appDocIds ORDER BY ContentDocument.CreatedDate DESC'
        );
        for (SObject cdl : cdls) {
            Id linkedId = (Id) cdl.get('LinkedEntityId');
            if (!appDocIdToContentDocId.containsKey(linkedId)) {
                appDocIdToContentDocId.put(linkedId, (Id) cdl.get('ContentDocumentId'));
            }
        }

        // Versions per ContentDocumentId (DESC by VersionNumber)
        Map<Id, List<SObject>> contentDocIdToVersions = new Map<Id, List<SObject>>();
        if (!appDocIdToContentDocId.isEmpty()) {
            Set<Id> contentDocIds = new Set<Id>(appDocIdToContentDocId.values());
            List<SObject> cvs = Database.query(
                'SELECT Id, ContentDocumentId, Title, VersionNumber, PathOnClient FROM ContentVersion ' +
                'WHERE ContentDocumentId IN :contentDocIds ORDER BY VersionNumber DESC'
            );
            for (SObject cv : cvs) {
                Id cdId = (Id) cv.get('ContentDocumentId');
                if (!contentDocIdToVersions.containsKey(cdId)) {
                    contentDocIdToVersions.put(cdId, new List<SObject>());
                }
                contentDocIdToVersions.get(cdId).add(cv);
            }
        }

        for (SObject d : appDocs) {
            Id docId = (Id) d.get('Id');
            Id cdId = appDocIdToContentDocId.get(docId);
            List<SObject> versions = cdId != null ? contentDocIdToVersions.get(cdId) : null;
            String status = (String) d.get('Status__c');
            String docName = (String) d.get('Document_Name__c');
            String fallbackName = (String) d.get('Name');
            String fileName = (String) d.get('File_Name__c');

            DocumentWrapper w = new DocumentWrapper();
            w.id = docId;
            w.title = String.isNotBlank(docName) ? docName : fallbackName;
            w.status = status;
            w.mandatory = d.get('Is_Document_Required__c') == true;
            w.submittedDate = isSubmitted(status) ? (Datetime) d.get('LastModifiedDate') : null;
            w.contentDocumentId = cdId;
            if (versions != null && !versions.isEmpty()) {
                w.latestVersionId = (Id) versions[0].get('Id');
                w.fileName = (String) versions[0].get('PathOnClient');
            } else {
                w.fileName = fileName;
            }
            result.add(w);
        }
        return result;
    }

    /**
     * GRANTS: delegate to GrantsDocumentUploadController.getAllDocuments and normalize.
     * Delegation is dynamic (Type.forName + Callable) so the class compiles in orgs
     * that don't have GrantsDocumentUploadController. The target class must implement
     * Callable with action 'getAllDocuments' accepting input.proposal for this branch to
     * return data.
     */
    private static List<DocumentWrapper> fetchGrantsDocuments(String recordId) {
        List<DocumentWrapper> normalized = new List<DocumentWrapper>();
        String docsJson = invokeGrantsLegacyDocs(recordId);
        if (String.isBlank(docsJson)) return normalized;

        List<Object> parsed;
        try {
            parsed = (List<Object>) JSON.deserializeUntyped(docsJson);
        } catch (Exception parseEx) {
            return normalized;
        }

        for (Object entry : parsed) {
            if (!(entry instanceof Map<String, Object>)) continue;
            Map<String, Object> docMap = (Map<String, Object>) entry;
            Map<String, Object> recMap = (Map<String, Object>) docMap.get('documentRecord');

            DocumentWrapper w = new DocumentWrapper();
            if (recMap != null) {
                w.id = stringFrom(recMap.get('Id'));
                w.title = stringFrom(recMap.get('Document_Title__c'));
                w.status = stringFrom(recMap.get('Status__c'));
                w.mandatory = recMap.get('Mandatory_by_default__c') == true;
                if (isSubmitted(w.status)) {
                    Object submitted = recMap.get('Submitted_Date__c');
                    if (submitted != null) {
                        try { w.submittedDate = (Datetime) JSON.deserialize('"' + submitted + '"', Datetime.class); }
                        catch (Exception ignored) { /* leave null on parse failure */ }
                    }
                }
            }
            w.contentDocumentId = stringFrom(docMap.get('contentDocumentId'));
            List<Object> versions = (List<Object>) docMap.get('contentVersionList');
            if (versions != null && !versions.isEmpty() && versions[0] instanceof Map<String, Object>) {
                w.latestVersionId = stringFrom(((Map<String, Object>) versions[0]).get('Id'));
            }
            w.fileName = stringFrom(docMap.get('fileName'));
            normalized.add(w);
        }
        return normalized;
    }

    /**
     * Dynamically invokes GrantsDocumentUploadController (if present) as a Callable and
     * returns the raw documents JSON string. Returns '[]' if the class does not exist
     * or is not Callable in the current org.
     */
    private static String invokeGrantsLegacyDocs(String recordId) {
        if (String.isBlank(recordId)) return '[]';
        Type t = Type.forName(GRANTS_DOC_CTRL);
        if (t == null) return '[]';
        Object inst;
        try {
            inst = t.newInstance();
        } catch (Exception e) {
            return '[]';
        }
        if (!(inst instanceof Callable)) return '[]';

        Map<String, Object> out = new Map<String, Object>();
        Map<String, Object> args = new Map<String, Object>{
            'input' => new Map<String, Object>{ 'proposal' => recordId },
            'output' => out,
            'options' => new Map<String, Object>()
        };
        try {
            ((Callable) inst).call('getAllDocuments', args);
        } catch (Exception e) {
            return '[]';
        }
        Object raw = out.get('documents');
        if (raw == null) return '[]';
        return raw instanceof String ? (String) raw : JSON.serialize(raw);
    }

    private static String stringFrom(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    /**
     * Normalized document shape consumed by c-unified-document-display.
     */
    global class DocumentWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String status;
        @AuraEnabled public Datetime submittedDate;
        @AuraEnabled public Boolean mandatory;
        @AuraEnabled public String contentDocumentId;
        @AuraEnabled public String latestVersionId;
        @AuraEnabled public String fileName;
    }
}