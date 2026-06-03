//javascript/controllers/applicationController.js
import { Placeholder } from "../core/components/placeholder.mjs";

export class ApplicationController {
    constructor(element) {
        this.element = element;
        this.targets = {};
        this.values = {};
    }

    getPageName() {
        const parts = window.location.pathname.split("/").filter(Boolean);

        if (parts.includes("edit")) return "edit";
        if (parts.includes("create") || parts.includes("new")) return "new";
        if (parts.length >= 2) return "show";

        return "index";
    }

    resolveTarget(target) {
        if (!target) return null;
        if (typeof target === 'string') {
            return this.element?.querySelector(target) ?? null;
        }
        return target;
    }

    showPlaceholder(target, type = 'skeleton-text', options = {}) {
        const el = this.resolveTarget(target);
        if (!el) return;
        Placeholder.show(el, type, options);
    }

    hidePlaceholder(target) {
        const el = this.resolveTarget(target);
        if (!el) return;
        Placeholder.hide(el);
    }

    hideAllPlaceholders() {
        Placeholder.hideAll();
    }
}