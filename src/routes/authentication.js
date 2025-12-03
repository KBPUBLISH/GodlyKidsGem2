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

        // Create unique username from email prefix + random suffix
        // This ensures uniqueness even if firstName is generic like "User"
        const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const baseUsername = firstName && firstName !== 'User' ? firstName : emailPrefix;
        let username = `${baseUsername}_${randomSuffix}`;
        
        // Double-check username is unique (in case of collision)
        let existingUser = await User.findOne({ username });
        while (existingUser) {
            const newSuffix = Math.random().toString(36).substring(2, 8);
            username = `${baseUsername}_${newSuffix}`;
            existingUser = await User.findOne({ username });
        }

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
