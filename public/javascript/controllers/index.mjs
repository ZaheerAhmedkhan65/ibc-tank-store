//javascript/controllers/index.mjs
import { Framework } from "../core/framework.mjs";

const controllerFiles = [
    "./product_controller.mjs",
];

const app = new Framework();

async function loadControllers() {
    for (const path of controllerFiles) {
        const module = await import(path);

        const name = path
            .split("/")
            .pop()
            .replace("_controller.mjs", "");

        app.register(name, module.default);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadControllers();   // ✅ wait here
    app.start();               // ✅ now controllers exist
});