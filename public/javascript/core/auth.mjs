//javascript/core/auth.js
export class Auth {
    static getUser() {
        const raw = document.getElementById("user-data")?.textContent;
        return raw ? JSON.parse(raw) : null;
    }

    static hasRole(role) {
        const user = this.getUser();
        return user?.roles?.some(r => r.role === role);
    }
}