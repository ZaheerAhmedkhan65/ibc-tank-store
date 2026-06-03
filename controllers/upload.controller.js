// controllers/upload.controller.js
const { uploadForResource } = require('../middlewares/upload');
const AppError = require('../utils/AppError');

/**
 * Upload post thumbnail (field: 'thumbnail')
 * Used in routes: POST /api/upload/thumbnail
 */
exports.uploadThumbnail = (req, res, next) => {
    const upload = uploadForResource('posts', {
        fieldName: 'thumbnail',
        transformationType: 'thumbnail',
        width: 800,
        height: 600,
        maxSize: 5 * 1024 * 1024
    });

    upload(req, res, (err) => {
        if (err) return next(err);
        if (!req.file) return next(new AppError('No file uploaded', 400));

        // Get Cloudinary public ID for additional transformations if needed
        const publicId = req.file.filename;

        res.status(200).json({
            status: 'success',
            data: {
                url: req.file.path,
                publicId: publicId,
                width: req.file.width || 800,
                height: req.file.height || 600,
                transformations: {
                    original: req.file.path,
                    thumbnail: req.file.path.replace('/upload/', '/upload/w_400,h_300,c_limit/'),
                    medium: req.file.path.replace('/upload/', '/upload/w_800,h_600,c_limit/')
                }
            }
        });
    });
};

/**
 * Upload product image (field: 'image')
 * Used in routes: POST /api/upload/image
 */
exports.uploadContentImage = (req, res, next) => {
    const upload = uploadForResource('products', {
        fieldName: 'image',
        transformationType: 'product',
        width: 500,
        height: 500,
        maxSize: 5 * 1024 * 1024  // 5MB for product images
    });
    upload(req, res, (err) => {
        if (err) return next(err);
        if (!req.file) return next(new AppError('No file uploaded', 400));

        const publicId = req.file.filename;
        res.status(200).json({
            status: 'success',
            data: {
                url: req.file.path,
                publicId: publicId,
                width: req.file.width || 500,
                height: req.file.height || 500,
                transformations: {
                    original: req.file.path,
                    large: req.file.path.replace('/upload/', '/upload/w_1920,h_1080,c_limit/'),
                    medium: req.file.path.replace('/upload/', '/upload/w_800,h_600,c_limit/'),
                    small: req.file.path.replace('/upload/', '/upload/w_400,h_300,c_limit/')
                }
            }
        });
    });
};

/**
 * Upload user avatar (field: 'avatar')
 * Used in routes: POST /api/upload/avatar
 */
exports.uploadAvatar = (req, res, next) => {
    const upload = uploadForResource('avatars', {
        fieldName: 'avatar',
        transformationType: 'avatar',
        width: 300,
        height: 300,
        maxSize: 2 * 1024 * 1024  // 2MB limit for avatars
    });

    upload(req, res, (err) => {
        if (err) return next(err);
        if (!req.file) return next(new AppError('No file uploaded', 400));

        const publicId = req.file.filename;

        res.status(200).json({
            status: 'success',
            data: {
                url: req.file.path,
                publicId: publicId,
                width: req.file.width || 300,
                height: req.file.height || 300,
                transformations: {
                    original: req.file.path,
                    thumbnail: req.file.path.replace('/upload/', '/upload/w_100,h_100,c_fill,g_face,r_max/'),
                    medium: req.file.path.replace('/upload/', '/upload/w_200,h_200,c_fill,g_face,r_max/'),
                    large: req.file.path.replace('/upload/', '/upload/w_300,h_300,c_fill,g_face,r_max/')
                }
            }
        });
    });
};

/**
 * Upload payment proof (field: 'proof')
 * Used in routes: POST /api/upload/payment-proof
 */
exports.uploadPaymentProof = (req, res, next) => {
    const upload = uploadForResource('payments', {
        fieldName: 'proof',
        transformationType: 'payment',
        width: 1500,
        height: 1500,
        maxSize: 10 * 1024 * 1024  // 10MB for payment proofs
    });

    upload(req, res, (err) => {
        if (err) return next(err);
        if (!req.file) return next(new AppError('No file uploaded', 400));

        const publicId = req.file.filename;

        res.status(200).json({
            status: 'success',
            data: {
                url: req.file.path,
                publicId: publicId,
                width: req.file.width || 1500,
                height: req.file.height || 1500,
                transformations: {
                    original: req.file.path,
                    preview: req.file.path.replace('/upload/', '/upload/w_500,h_500,c_limit/'),
                    full: req.file.path.replace('/upload/', '/upload/w_1500,h_1500,c_limit/')
                }
            }
        });
    });
};

/**
 * Generic function to get transformed URL
 * @param {string} originalUrl - Original Cloudinary URL
 * @param {Object} options - Transformation options (width, height, crop, etc.)
 * @returns {string}
 */
exports.getTransformedUrl = (originalUrl, options = {}) => {
    if (!originalUrl) return null;

    const transformations = [];

    if (options.width) transformations.push(`w_${options.width}`);
    if (options.height) transformations.push(`h_${options.height}`);
    if (options.crop) transformations.push(`c_${options.crop}`);
    if (options.quality) transformations.push(`q_${options.quality}`);
    if (options.radius) transformations.push(`r_${options.radius}`);
    if (options.gravity) transformations.push(`g_${options.gravity}`);
    if (options.format) transformations.push(`f_${options.format}`);

    if (transformations.length === 0) return originalUrl;

    // Insert transformations after '/upload/'
    return originalUrl.replace('/upload/', `/upload/${transformations.join(',')}/`);
};