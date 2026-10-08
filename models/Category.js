// models/Category.js
const db = require("../config/db");

const slugify = (text) =>
    String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

class Category {
    static async create(data) {
        const {
            name,
            slug,
            description = null,
            meta_title = null,
            meta_description = null,
            icon = null,
            is_active = 1
        } = data;

        let finalSlug = slugify(slug || name);
        const [insertResult] = await db.execute(
            `INSERT INTO categories (name, slug, description, meta_title, meta_description, icon, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, finalSlug, description, meta_title, meta_description, icon, is_active ? 1 : 0]
        );

        const [rows] = await db.execute('SELECT * FROM categories WHERE id = ?', [insertResult.insertId]);
        return rows[0];
    }

    static async getAll({ activeOnly = false } = {}) {
        const sql = activeOnly
            ? 'SELECT * FROM categories WHERE is_active = 1 ORDER BY name'
            : 'SELECT * FROM categories ORDER BY name';
        const [rows] = await db.execute(sql);
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.execute('SELECT * FROM categories WHERE id = ?', [id]);
        return rows[0] || null;
    }

    static async getBySlug(slug, { activeOnly = false } = {}) {
        const sql = activeOnly
            ? 'SELECT * FROM categories WHERE slug = ? AND is_active = 1'
            : 'SELECT * FROM categories WHERE slug = ?';
        const [rows] = await db.execute(sql, [slug]);
        return rows[0] || null;
    }

    static async update(id, data) {
        const {
            name,
            slug,
            description = null,
            meta_title = null,
            meta_description = null,
            icon = null,
            is_active = 1
        } = data;

        const finalSlug = slugify(slug || name);
        const [result] = await db.execute(
            `UPDATE categories
             SET name = ?, slug = ?, description = ?, meta_title = ?, meta_description = ?, icon = ?, is_active = ?
             WHERE id = ?`,
            [name, finalSlug, description, meta_title, meta_description, icon, is_active ? 1 : 0, id]
        );
        return result;
    }

    static async delete(id) {
        const result = await db.execute('DELETE FROM categories WHERE id = ?', [id]);
        return result;
    }

    // Products belonging to this category (for the public category page)
    static async getCategoryProducts(categoryId, { limit = 12 } = {}) {
        const [rows] = await db.execute(
            `SELECT p.* FROM products p
             WHERE p.category_id = ? AND p.stock > 0
             ORDER BY p.created_at DESC
             LIMIT ${parseInt(limit, 10) || 12}`,
            [categoryId]
        );
        return rows;
    }

    // ---------------------------------------------------------
    // Child rows: category_features / category_applications / category_faqs
    // ---------------------------------------------------------
    static async getFeatures(categoryId) {
        const [rows] = await db.execute(
            'SELECT * FROM category_features WHERE category_id = ? ORDER BY display_order, id',
            [categoryId]
        );
        return rows;
    }

    static async getApplications(categoryId) {
        const [rows] = await db.execute(
            'SELECT * FROM category_applications WHERE category_id = ? ORDER BY display_order, id',
            [categoryId]
        );
        return rows;
    }

    static async getFaqs(categoryId) {
        const [rows] = await db.execute(
            'SELECT * FROM category_faqs WHERE category_id = ? ORDER BY display_order, id',
            [categoryId]
        );
        return rows;
    }

    static async getWithDetails(idOrSlug, { activeOnly = false } = {}) {
        const category = /^\d+$/.test(String(idOrSlug))
            ? await this.getById(idOrSlug)
            : await this.getBySlug(idOrSlug, { activeOnly });
        if (!category) return null;

        category.features = await this.getFeatures(category.id);
        category.applications = await this.getApplications(category.id);
        category.faqs = await this.getFaqs(category.id);
        return category;
    }

    // Replace all child rows for a category (used on create/update)
    static async syncFeatures(categoryId, features = []) {
        await db.execute('DELETE FROM category_features WHERE category_id = ?', [categoryId]);
        return this._insertRows('category_features', categoryId, features, ['title', 'description', 'icon']);
    }

    static async syncApplications(categoryId, applications = []) {
        await db.execute('DELETE FROM category_applications WHERE category_id = ?', [categoryId]);
        return this._insertRows('category_applications', categoryId, applications, ['title', 'description', 'icon']);
    }

    static async syncFaqs(categoryId, faqs = []) {
        await db.execute('DELETE FROM category_faqs WHERE category_id = ?', [categoryId]);
        return this._insertRows('category_faqs', categoryId, faqs, ['question', 'answer']);
    }

    static async _insertRows(table, categoryId, rows, fields) {
        let count = 0;
        for (const row of rows) {
            const hasValue = fields.some(f => row[f] && String(row[f]).trim() !== '');
            if (!hasValue) continue;
            const values = fields.map(f => row[f] || null);
            const placeholders = fields.map(() => '?').join(', ');
            await db.execute(
                `INSERT INTO ${table} (category_id, ${fields.join(', ')}, display_order)
                 VALUES (?, ${placeholders}, ?)`,
                [categoryId, ...values, row.display_order ?? count]
            );
            count++;
        }
        return count;
    }
}

module.exports = Category;
