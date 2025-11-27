const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Sign-up endpoint (matches frontend expectation)
router.post('/sign-up', async (req, res) => {
    const { email, password, firstName, lastName, age, deviceInfo } = req.body;

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create username from email if not provided
        const username = firstName || email.split('@')[0];

        // Create new user
        user = new User({
            username,
            email,
            password,
        });

        await user.save();

        // Generate tokens
        const payload = {
            user: {
                id: user.id,
            },
        };

        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (err) {
        console.error('Sign-up error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Sign-in endpoint (matches frontend expectation)
router.post('/sign-in', async (req, res) => {
    const { email, password, deviceInfo } = req.body;

    try {
        // Find user
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate tokens
        const payload = {
            user: {
                id: user.id,
            },
        };

        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (err) {
        console.error('Sign-in error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Sign-in skip endpoint (for guest/social login)
router.post('/sign-in/skip', async (req, res) => {
    const { provider, deviceInfo } = req.body;

    try {
        // For now, create a guest token
        const payload = {
            user: {
                id: 'guest',
                type: 'guest',
            },
        };

        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: 'guest',
                username: 'Guest',
                email: null,
                type: 'guest',
            },
        });
    } catch (err) {
        console.error('Sign-in skip error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
