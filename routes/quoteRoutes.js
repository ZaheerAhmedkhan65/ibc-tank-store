// routes/quoteRoutes.js
const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { sendEmail } = require('../api/emailService');
const renderTemplate = require('../utils/templateRenderer');
const Setting = require('../models/Setting');

// Submit a quote request (from homepage form and product pages)
router.post('/submit', async (req, res) => {
    try {
        const { name, phone, city, product_type, quantity, intended_usage } = req.body;

        if (!name || !phone) {
            req.flash('error', 'Name and phone number are required.');
            return res.redirect(req.get('Referer') || '/');
        }

        const message = `Quote Request - ${product_type || 'Not specified'}`;

        await Contact.create(name, null, message, phone, {
            city: city || null,
            product_type: product_type || null,
            quantity: quantity ? parseInt(quantity) : null,
            intended_usage: intended_usage || null,
            is_quote: true
        });

        // Notify admin
        const settingsArr = await Setting.all();
        const settings = {};
        settingsArr.forEach(s => {
            try { settings[s.key] = JSON.parse(s.value); }
            catch { settings[s.key] = s.value; }
        });

        if (settings.notify_contact_submission) {
            const html = renderTemplate('contact_message.html', {
                name,
                contact_no: phone,
                message: `Quote Request\nProduct: ${product_type || 'N/A'}\nQuantity: ${quantity || 'N/A'}\nCity: ${city || 'N/A'}\nUsage: ${intended_usage || 'N/A'}`,
                year: new Date().getFullYear()
            });

            sendEmail({
                to: 'ibctank.team@gmail.com',
                subject: `New Quote Request from ${name}`,
                text: `Quote from ${name} - ${phone}`,
                html
            });
        }

        req.flash('success', 'Your quote request has been submitted! We will contact you shortly.');
        res.redirect(req.get('Referer') || '/');
    } catch (error) {
        console.error('Quote submit error:', error);
        req.flash('error', 'Failed to submit quote request. Please try again.');
        res.redirect(req.get('Referer') || '/');
    }
});

// Submit a general contact form (from contact page)
router.post('/contact', async (req, res) => {
    try {
        const { name, phone, email, city, subject, message } = req.body;

        if (!name || !message) {
            req.flash('error', 'Name and message are required.');
            return res.redirect(req.get('Referer') || '/');
        }

        await Contact.create(name, email || null, message, phone, {
            city: city || null,
            is_quote: false
        });

        const settingsArr = await Setting.all();
        const settings = {};
        settingsArr.forEach(s => {
            try { settings[s.key] = JSON.parse(s.value); }
            catch { settings[s.key] = s.value; }
        });

        if (settings.notify_contact_submission) {
            const html = renderTemplate('contact_message.html', {
                name,
                email: email || 'N/A',
                contact_no: phone || 'N/A',
                message: `Subject: ${subject || 'N/A'}\n\n${message}`,
                year: new Date().getFullYear()
            });

            sendEmail({
                to: 'ibctank.team@gmail.com',
                subject: `New Contact Message from ${name}`,
                text: `Message from ${name} - ${phone || 'No phone'}`,
                html
            });
        }

        req.flash('success', 'Your message has been sent! We will get back to you shortly.');
        res.redirect(req.get('Referer') || '/');
    } catch (error) {
        console.error('Contact submit error:', error);
        req.flash('error', 'Failed to send message. Please try again.');
        res.redirect(req.get('Referer') || '/');
    }
});

module.exports = router;