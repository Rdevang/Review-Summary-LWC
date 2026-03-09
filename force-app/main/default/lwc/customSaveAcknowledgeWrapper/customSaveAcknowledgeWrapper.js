import { track } from 'lwc';
import template from './customSaveAcknowledgeWrapper.html';
import omniscriptSaveForLaterAcknowledge from 'omnistudio/omniscriptSaveForLaterAcknowledge';

export default class CustomSaveAcknowledgeWrapper extends omniscriptSaveForLaterAcknowledge {

    @track _showContent = false;
    _hadResumeLinkOnMount = false;

    render() {
        return template;
    }

    connectedCallback() {
        if (super.connectedCallback) {
            super.connectedCallback();
        }
        // Only show when link was absent on load but appeared after save (user just clicked "Save for Later")
        this._hadResumeLinkOnMount = !!(this.resumeLink || this.saveUrl);
        setTimeout(() => {
            const linkAppearedAfterMount = !this._hadResumeLinkOnMount && !!(this.resumeLink || this.saveUrl);
            const notAutoSave = this.isAutoSave !== true && this.bAutoSave !== true;
            if (linkAppearedAfterMount && notAutoSave) {
                this._showContent = true;
            }
        }, 500);
    }

    /**
     * True only when there is a resume/save link AND it was an explicit user click (not auto-save).
     * We only show when the link *appeared* after mount (save just completed), not when it was already set (e.g. on every step).
     */
    get isExplicitSaveForLater() {
        if (this.isAutoSave === true || this.bAutoSave === true) {
            return false;
        }
        return !!(this.resumeLink || this.saveUrl);
    }

    get showAcknowledgeContent() {
        return this._showContent;
    }
}
