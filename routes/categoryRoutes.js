// routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public category page: /categories/:slug
router.get('/:slug', categoryController.show);

module.exports = router;
