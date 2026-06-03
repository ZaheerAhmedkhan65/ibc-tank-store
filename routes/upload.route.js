// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { isAuthenticated, isAdmin } = require('../middlewares/authenticate');

router.post('/image', isAuthenticated, isAdmin, uploadController.uploadContentImage);

module.exports = router;