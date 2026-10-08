// controllers/categoryController.js
const Category = require('../models/Category');
const Product = require('../models/Product');

// Normalise a nested row payload (array or object map) coming from the client
const normalizeRows = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input.filter(Boolean);
    if (typeof input === 'object') {
        return Object.keys(input)
            .map(Number)
            .sort((a, b) => a - b)
            .map(k => input[k])
            .filter(Boolean);
    }
    try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (e) {
        return [];
    }
};

const extractPayload = (body) => ({
    name: (body.name || '').trim(),
    slug: (body.slug || '').trim() || undefined,
    description: body.description || null,
    meta_title: body.meta_title || null,
    meta_description: body.meta_description || null,
    icon: (body.icon || '').trim() || null,
    is_active: body.is_active === '1' || body.is_active === 1 || body.is_active === true || body.is_active === 'on' ? 1 : 0,
    features: normalizeRows(body.features).map((row, i) => ({
        title: row.title || null,
        description: row.description || null,
        icon: row.icon || null,
        display_order: Number(row.display_order ?? i)
    })),
    applications: normalizeRows(body.applications).map((row, i) => ({
        title: row.title || null,
        description: row.description || null,
        icon: row.icon || null,
        display_order: Number(row.display_order ?? i)
    })),
    faqs: normalizeRows(body.faqs).map((row, i) => ({
        question: row.question || null,
        answer: row.answer || null,
        display_order: Number(row.display_order ?? i)
    }))
});

// Returns a redirect for HTML form posts, JSON for API-style posts.
// Module-level helper (not a method) so it works regardless of how the
// route binds the handler — Express calls handlers unbound, so `this` is lost.
const respond = (req, res, { success, error = null, redirectTo = '/admin/categories' }) => {
    const isJson = String(req.get('Content-Type') || '').includes('application/json');
    if (isJson) {
        return res.status(success ? 200 : 500).json({ success, error });
    }
    if (success) {
        req.flash('success', error || 'Saved.');
        return res.redirect(redirectTo);
    }
    req.flash('error', error || 'Failed.');
    return res.redirect(redirectTo);
};

const categoryController = {
    // ---------------- Admin ----------------
    async list(req, res) {
        const categories = await Category.getAll();
        res.render('admin/category/index', { title: 'Categories', categories, viewPage: 'categories' });
    },

    async details(req, res) {
        const category = await Category.getWithDetails(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found.' });
        }
        res.json({ success: true, category });
    },

    async createForm(req, res) {
        res.render('admin/category/new', { title: 'New Category', viewPage: 'categories', category: null });
    },

    async editForm(req, res) {
        const category = await Category.getWithDetails(req.params.categoryId);
        if (!category) {
            req.flash('error', 'Category not found.');
            return res.redirect('/admin/categories');
        }
        res.render('admin/category/edit', { title: `Edit: ${category.name}`, viewPage: 'categories', category });
    },

    async create(req, res) {
        try {
            const payload = extractPayload(req.body);
            if (!payload.name) {
                return respond(req, res, { success: false, error: 'Category name is required.' });
            }
            const category = await Category.create(payload);
            await Category.syncFeatures(category.id, payload.features);
            await Category.syncApplications(category.id, payload.applications);
            await Category.syncFaqs(category.id, payload.faqs);
            return respond(req, res, { success: true, error: 'Category created successfully.' });
        } catch (error) {
            console.error('Create category error:', error);
            const message = error.code === 'ER_DUP_ENTRY'
                ? 'A category with that slug already exists.'
                : 'Failed to create category.';
            return respond(req, res, { success: false, error: message });
        }
    },

    async update(req, res) {
        try {
            const { categoryId } = req.params;
            const payload = extractPayload(req.body);
            if (!payload.name) {
                return respond(req, res, { success: false, error: 'Category name is required.' });
            }
            await Category.update(categoryId, payload);
            await Category.syncFeatures(categoryId, payload.features);
            await Category.syncApplications(categoryId, payload.applications);
            await Category.syncFaqs(categoryId, payload.faqs);
            return respond(req, res, { success: true, error: 'Category updated successfully.' });
        } catch (error) {
            console.error('Update category error:', error);
            const message = error.code === 'ER_DUP_ENTRY'
                ? 'A category with that slug already exists.'
                : 'Failed to update category.';
            return respond(req, res, { success: false, error: message });
        }
    },

    async delete(req, res) {
        try {
            // Route param is `:categoryId` (see routes/adminRoutes.js) — NOT `id`.
            const { categoryId } = req.params;
            await Category.delete(categoryId);
            req.flash('success', 'Category deleted successfully.');
            return res.redirect('/admin/categories');
        } catch (error) {
            console.error('Delete category error:', error);
            req.flash('error', 'Failed to delete category.');
            return res.redirect('/admin/categories');
        }
    },

    // ---------------- Public + Admin ----------------
    // Public route:  GET /categories/:slug                -> req.params.slug
    // Admin route:   GET /admin/categories/:categoryId   -> req.params.categoryId (numeric id or slug)
    async show(req, res) {
        try {
            const idOrSlug = req.params.slug || req.params.categoryId;
            const isAdminView = req.baseUrl === '/admin';

            // Admins can view inactive categories too; the public page only shows active ones.
            const category = await Category.getWithDetails(idOrSlug, { activeOnly: !isAdminView });
            if (!category) {
                req.flash('error', 'Category not found.');
                return res.redirect(isAdminView ? '/admin/categories' : '/products');
            }

            if (isAdminView) {
                // Admin detail page: every product of the category (incl. out of stock).
                const products = await Product.getByCategory(category.id);
                return res.render('admin/category/show', {
                    title: category.name,
                    viewPage: 'categories-show',
                    category,
                    products
                });
            }

            const products = await Category.getCategoryProducts(category.id);
            return res.render('public/categories/show', {
                title: category.meta_title || category.name,
                metaDescription: category.meta_description,
                category,
                products
            });
        } catch (error) {
            console.error('Show category error:', error);
            req.flash('error', 'Failed to load category details.');
            return res.redirect(req.baseUrl === '/admin' ? '/admin/categories' : '/products');
        }
    }
};

module.exports = categoryController;