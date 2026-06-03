// core/components/card.mjs
export class CardComponent {
    constructor({
        element,
        data = [],
        fields = [],
        imageKey = null,
        actions = [],
        dropdownPosition = "top", // 🔥 NEW
        pageSize = 8
    }) {
        this.element = element;
        this.data = data;
        this.fields = fields;
        this.imageKey = imageKey;
        this.actions = actions;
        this.dropdownPosition = dropdownPosition;
        this.pageSize = pageSize;
        this.currentPage = 1;
    }

    render() {
        this.element.innerHTML = "";

        this.grid = document.createElement("div");
        this.grid.className = "row";

        this.element.appendChild(this.grid);

        this.renderCards();
    }

    renderCards() {
        this.grid.innerHTML = "";

        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = this.data.slice(start, start + this.pageSize);

        pageData.forEach(item => {
            const col = document.createElement("div");
            col.className = "col-lg-3 col-md-4 col-sm-6 mb-3";

            const card = document.createElement("div");
            card.className = "card h-100 shadow-sm position-relative overflow-hidden";

            // 🖼 IMAGE + TITLE OVERLAY
            if (this.imageKey && item[this.imageKey]) {
                const imgWrapper = document.createElement("div");
                imgWrapper.className = "position-relative";

                const img = document.createElement("img");
                img.src = item[this.imageKey];
                img.className = "card-img-top";
                img.style.height = "160px";
                img.style.objectFit = "cover";

                imgWrapper.appendChild(img);

                // 🔥 TITLE OVER IMAGE
                const titleField = this.fields.find(f => f.type === "title" && f.overlay);

                if (titleField) {
                    const overlay = document.createElement("div");
                    overlay.className = "position-absolute bottom-0 start-0 w-100 p-2 text-white";
                    overlay.style.background = "linear-gradient(transparent, rgba(0,0,0,0.7))";

                    let content = item[titleField.key] || "";

                    // 🔗 Link support
                    if (titleField.link) {
                        overlay.innerHTML = `<a href="${titleField.link(item)}" class="text-white link-hover-underline fs-3">${content}</a>`;
                    } else {
                        overlay.innerHTML = `<strong class="fw-bold fs-3">${content}</strong>`;
                    }

                    imgWrapper.appendChild(overlay);
                }

                card.appendChild(imgWrapper);
            }

            const body = document.createElement("div");
            body.className = "card-body";

            // 🔥 Dynamic Fields
            this.fields.forEach(field => {
                const value = item[field.key];

                // Skip overlay title (already rendered)
                if (field.type === "title" && field.overlay) return;

                let content = value ?? "-";

                // 🔗 LINK SUPPORT
                if (field.link) {
                    content = `<a href="${field.link(item)}" class="link-hover-underline">${content}</a>`;
                }

                if (field.type === "title") {
                    const h5 = document.createElement("h5");
                    h5.className = "card-title";
                    h5.innerHTML = content;
                    body.appendChild(h5);
                }

                else if (field.type === "badge") {
                    const badge = document.createElement("span");
                    badge.className = `badge ${value ? "bg-success" : "bg-secondary"
                        } position-absolute top-0 start-0 m-2`;
                    badge.textContent = value
                        ? field.trueLabel || "Active"
                        : field.falseLabel || "Inactive";
                    card.appendChild(badge);
                }

                else if (field.type === "color") {
                    const div = document.createElement("div");
                    div.innerHTML = `
                        <strong>${field.label}:</strong>
                        <span style="display:inline-block;width:15px;height:15px;background:${value};border-radius:3px;"></span>
                    `;
                    body.appendChild(div);
                } else if(field.label) {
                    const p = document.createElement("p");
                    p.className = "mb-1 small";
                    p.innerHTML = `<strong>${field.label}:</strong> ${content}`;
                    body.appendChild(p);
                }
                else {
                    const p = document.createElement("p");
                    p.className = "mb-1 small";
                    p.innerHTML = `${content}`;
                    body.appendChild(p);
                }
            });

            // 🔥 ACTION DROPDOWN (POSITION CONTROL)
            if (this.actions.length) {
                const dropdown = document.createElement("div");

                const positionClass =
                    this.dropdownPosition === "bottom"
                        ? "bottom-0 end-0 m-2"
                        : "top-0 end-0 m-2";

                dropdown.className = `dropdown position-absolute ${positionClass}`;

                dropdown.innerHTML = `
                    <button class="btn btn-sm btn-light" data-bs-toggle="dropdown">
                        ⋮
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end"></ul>
                `;

                const menu = dropdown.querySelector(".dropdown-menu");

                this.actions.forEach(action => {
                    const li = document.createElement("li");
                    li.innerHTML = `<a class="dropdown-item" href="#">${action.label}</a>`;

                    li.onclick = (e) => {
                        e.preventDefault();
                        action.onClick?.(item);
                    };

                    menu.appendChild(li);
                });

                card.appendChild(dropdown);
            }

            card.appendChild(body);
            col.appendChild(card);
            this.grid.appendChild(col);
        });
    }

    updateData(data) {
        this.data = data;
        this.render();
    }
}