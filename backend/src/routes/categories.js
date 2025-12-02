const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// Get all categories (optionally filtered by type or explore flag)
router.get('/', async (req, res) => {
    try {
        const { type, explore } = req.query;
        const query = {};
        if (type) {
            query.type = type;
        }
        if (explore === 'true' || explore === true || explore === '1') {
            query.showOnExplore = true; // Only return categories explicitly marked for explore page
        }
        const categories = await Category.find(query).lean().sort({ name: 1 });
        // Additional safety: filter out any categories that don't have showOnExplore when explore=true
        const filtered = explore === 'true' || explore === true || explore === '1'
            ? categories.filter(cat => cat.showOnExplore === true)
            : categories;
        // Ensure showOnExplore is included in all responses
        const response = filtered.map(cat => ({
            ...cat,
            showOnExplore: cat.showOnExplore !== undefined ? cat.showOnExplore : false
        }));
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single category
router.get('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).lean();
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        // Ensure showOnExplore is included
        const responseData = {
            ...category,
            showOnExplore: category.showOnExplore !== undefined ? category.showOnExplore : false
        };
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create category
router.post('/', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const { name, type, description, color, icon, showOnExplore } = req.body;
        
        console.log('Creating category with data:', { name, type, description, color, icon, showOnExplore });
        
        if (!name || !name.trim()) {
            console.error('Category creation failed: name is required');
            return res.status(400).json({ error: 'Category name is required' });
        }
        
        if (!type || !['book', 'audio'].includes(type)) {
            console.error('Category creation failed: invalid type', type);
            return res.status(400).json({ error: 'Category type must be either "book" or "audio"' });
        }
        
        // Check if category already exists for this type (case-insensitive)
        const trimmedName = name.trim();
        // Escape special regex characters in the name
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await Category.findOne({ 
            name: { $regex: new RegExp(`^${escapedName}$`, 'i') }, 
            type: type 
        });
        if (existing) {
            return res.status(400).json({ 
                error: `Category "${trimmedName}" already exists for ${type} categories. Each category type (book, audio) can have its own set of categories with the same names.` 
            });
        }

        const category = new Category({
            name: name.trim(),
            type: type,
            description: description || '',
            color: color || '#6366f1',
            icon: icon || '',
            showOnExplore: showOnExplore === true || showOnExplore === 'true',
        });

        await category.save();
        console.log('Category created successfully:', category._id);
        res.status(201).json(category);
    } catch (error) {
        console.error('Category creation error:', error);
        if (error.code === 11000) {
            res.status(400).json({ error: `Category "${name?.trim() || 'Unknown'}" already exists for ${type || 'unknown'} categories. Each category type (book, audio) can have its own set of categories with the same names.` });
        } else {
            res.status(500).json({ error: error.message || 'Failed to create category' });
        }
    }
});

// Update category
router.put('/:id', async (req, res) => {
    try {
        const { name, type, description, color, icon, showOnExplore } = req.body;
        
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Validate type if provided
        if (type && !['book', 'audio'].includes(type)) {
            return res.status(400).json({ error: 'Category type must be either "book" or "audio"' });
        }

        // Check if new name/type combination conflicts with existing category (case-insensitive)
        const newName = name ? name.trim() : category.name;
        const newType = type || category.type;
        
        if ((name && name.trim() !== category.name) || (type && type !== category.type)) {
            // Escape special regex characters in the name
            const escapedName = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const existing = await Category.findOne({ 
                name: { $regex: new RegExp(`^${escapedName}$`, 'i') }, 
                type: newType, 
                _id: { $ne: category._id } 
            });
            if (existing) {
            return res.status(400).json({ 
                error: `Category "${newName}" already exists for ${newType} categories. Each category type (book, audio) can have its own set of categories with the same names.` 
            });
            }
        }

        category.name = newName;
        category.type = newType;
        category.description = description !== undefined ? description : category.description;
        category.color = color || category.color;
        category.icon = icon !== undefined ? icon : category.icon;
        // Always update showOnExplore if provided in request body
        // Handle both true and false values explicitly
        console.log('showOnExplore from req.body:', showOnExplore, 'type:', typeof showOnExplore, 'undefined?', showOnExplore === undefined, 'null?', showOnExplore === null);
        if (showOnExplore !== undefined && showOnExplore !== null) {
            // Convert various truthy/falsy values to boolean
            const boolValue = showOnExplore === true || showOnExplore === 'true' || showOnExplore === 1 || showOnExplore === '1';
            category.showOnExplore = boolValue;
            console.log('Setting showOnExplore to:', boolValue, 'from input:', showOnExplore);
            console.log('Category.showOnExplore after setting:', category.showOnExplore);
        } else {
            console.log('showOnExplore not provided in request, keeping existing value:', category.showOnExplore);
        }
        category.updatedAt = Date.now();
        
        console.log('Updating category:', {
            id: category._id,
            name: category.name,
            showOnExplore: category.showOnExplore,
            showOnExploreFromBody: showOnExplore,
            showOnExploreType: typeof showOnExplore
        });

        // Save the category
        const saved = await category.save();
        console.log('Category saved, showOnExplore:', saved.showOnExplore);
        
        // Verify the saved value by fetching fresh from database
        const savedCategory = await Category.findById(category._id).lean();
        console.log('Category after save (lean):', {
            id: savedCategory._id,
            name: savedCategory.name,
            showOnExplore: savedCategory.showOnExplore,
            showOnExploreType: typeof savedCategory.showOnExplore,
            allFields: Object.keys(savedCategory)
        });
        
        // Ensure showOnExplore is explicitly included in response
        const responseData = {
            ...savedCategory,
            showOnExplore: savedCategory.showOnExplore !== undefined ? savedCategory.showOnExplore : false
        };
        console.log('Response data before sending:', responseData);
        console.log('showOnExplore in responseData:', responseData.showOnExplore);
        
        res.json(responseData);
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Category name must be unique' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Delete category
router.delete('/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

