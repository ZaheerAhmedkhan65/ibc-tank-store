// controllers/base/crud_controller.mjs
import { ApplicationController } from "../applicationController.mjs";
import { Toast } from "../../core/components/toast.mjs";

export class CRUDController extends ApplicationController {

    constructor() {
        super();
        this.baseUrl = "";
        this.entityName = "";
    }

    // ======================
    // CREATE
    // ======================
    async create(payload) {
        try {
            const res = await fetch(this.baseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            Toast.show({ message: result.message });
            return result;

        } catch (err) {
            Toast.show({ message: err.message });
            throw err;
        }
    }

    // ======================
    // UPDATE
    // ======================
    async update(id, payload, isFormData = false) {
        try {
            const res = await fetch(`${this.baseUrl}/${id}?_method=PATCH`, {
                method: "POST",
                headers: isFormData ? {} : {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: isFormData ? payload : JSON.stringify(payload)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            Toast.show({ message: `${this.entityName} updated` });

            return result.data;

        } catch (err) {
            Toast.show({ message: err.message });
            throw err;
        }
    }

    // ======================
    // DELETE
    // ======================
    async remove(id = "", url = null) {
        try {
            const endpoint = url || `${this.baseUrl}/${id}?_method=DELETE`;

            const res = await fetch(endpoint, {
                method: "POST",
                credentials: "include"
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            Toast.show({ message: `${this.entityName} deleted` });

            return result;

        } catch (err) {
            Toast.show({ message: err.message });
            throw err;
        }
    }

    // ======================
    // GET ONE
    // ======================
    async find(id, url = null) {
        const res = await fetch(url ? url : `${this.baseUrl}/${id}`);
        const result = await res.json();

        if (!res.ok) throw new Error(result.message);

        return result.data;
    }

    // ======================
    // GET ALL
    // ======================
    async getAll() {
        const res = await fetch(this.baseUrl);
        const result = await res.json();

        if (!res.ok) throw new Error(result.message);

        return result.data;
    }

}