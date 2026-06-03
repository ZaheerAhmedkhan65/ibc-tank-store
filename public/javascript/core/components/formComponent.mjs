// core/components/form.mjs
export class FormComponent {
    constructor({ form, fields, onSubmit }) {
        this.form = form;
        this.fields = fields;
        this.onSubmit = onSubmit;

        this.bind();
    }

    bind() {
        this.form.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const payload = {};

            Object.keys(this.fields).forEach(key => {
                const field = this.fields[key];
                if (field) {
                    payload[key] = field.value;
                } else {
                    console.warn(`Field "${key}" is undefined, skipping`);
                }
            });

            this.onSubmit(payload);
        });
    }

    setValues(data) {
        Object.keys(this.fields).forEach(key => {
            const field = this.fields[key];
            if (!field || field.type === 'file') return; // ❌ Skip file inputs

            if (field.type === 'checkbox') {
                field.checked = !!data[key];   // ✅ set checked state
            } else {
                field.value = data[key] || "";
            }
        });
    }
}