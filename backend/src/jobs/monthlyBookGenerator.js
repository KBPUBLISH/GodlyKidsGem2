const CustomMonthlyBook = require('../models/CustomMonthlyBook');
const MonthlyBookTemplate = require('../models/MonthlyBookTemplate');
const SavedCharacter = require('../models/SavedCharacter');
const Book = require('../models/Book');
const { sendNotificationToUser } = require('../services/notificationService');

const PLACEHOLDER_PAGE_IMAGE = 'https://picsum.photos/seed/story/800/600';

/**
 * Substitute {childName} in template text.
 */
function substituteChildName(text, childName) {
    if (!text || !childName) return text || '';
    return String(text).replace(/\{childName\}/g, childName);
}

/**
 * Generate one page image (stub: returns placeholder; later wire Imagen).
 * In the future: build scene prompt from template + bible character stylePrompt + child ref, call Imagen, upload to GCS, return URL.
 */
async function generatePageImage(_customBook, _templatePage, _bibleCharacter, _pageIndex) {
    // TODO: Build scene prompt from template + bible character stylePrompt + child ref; call Imagen; upload to GCS; return URL.
    return PLACEHOLDER_PAGE_IMAGE;
}

/**
 * Run monthly book generation for a single CustomMonthlyBook.
 * Creates Book with embedded pages, updates CustomMonthlyBook, sends notification.
 */
async function runMonthlyBookGeneration(customMonthlyBookId) {
    const custom = await CustomMonthlyBook.findById(customMonthlyBookId)
        .populate('templateId')
        .lean();
    if (!custom) {
        console.error('MonthlyBookGenerator: CustomMonthlyBook not found', customMonthlyBookId);
        return;
    }
    if (custom.status !== 'pending') {
        console.log('MonthlyBookGenerator: Skipping non-pending', customMonthlyBookId, custom.status);
        return;
    }

    await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, { status: 'generating' });

    try {
        const template = await MonthlyBookTemplate.findById(custom.templateId).populate('bibleCharacterId').lean();
        if (!template || !template.bibleCharacterId) {
            throw new Error('Template or Bible character not found');
        }
        const bibleCharacter = template.bibleCharacterId;
        const storyPages = template.storyPages || [];
        const pageCount = custom.hasTrialOrPaid
            ? storyPages.length
            : Math.min(4, storyPages.length);
        const pagesToGenerate = storyPages.slice(0, pageCount);

        const bookTitle = `${custom.childName}'s Adventure with ${bibleCharacter.displayName}`;
        const pages = [];
        for (let i = 0; i < pagesToGenerate.length; i++) {
            const tp = pagesToGenerate[i];
            const pageText = substituteChildName(tp.text, custom.childName);
            const backgroundUrl = await generatePageImage(custom, tp, bibleCharacter, i);
            pages.push({
                pageNumber: i + 1,
                content: {
                    text: pageText,
                    textBoxes: [
                        {
                            text: pageText,
                            x: 50,
                            y: 75,
                            width: 80,
                            alignment: 'center',
                            fontFamily: 'Patrick Hand',
                            fontSize: 22,
                            color: '#4a3b2a',
                        },
                    ],
                },
                files: {
                    background: {
                        url: backgroundUrl,
                        type: 'image',
                    },
                },
            });
        }

        const book = await Book.create({
            title: bookTitle,
            author: 'GodlyKids',
            description: `A custom story for ${custom.childName} with ${bibleCharacter.displayName}.`,
            status: 'published',
            pages,
            files: {
                coverImage: pages[0]?.files?.background?.url || PLACEHOLDER_PAGE_IMAGE,
                images: [],
                videos: [],
                audio: [],
            },
            showCharacterOverlay: false,
        });

        await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
            status: 'completed',
            bookId: book._id,
            notificationSentAt: new Date(),
        });

        const notificationTitle = '✨ Your story is ready!';
        const notificationMessage = `${custom.childName}, your adventure with ${bibleCharacter.displayName} is ready!`;
        await sendNotificationToUser({
            userId: custom.userId,
            title: notificationTitle,
            message: notificationMessage,
            url: `/book/${book._id}`,
            data: { type: 'monthly_book_ready', bookId: String(book._id), customMonthlyBookId: String(customMonthlyBookId) },
        });

        console.log('MonthlyBookGenerator: Completed', customMonthlyBookId, 'bookId', book._id);
    } catch (err) {
        console.error('MonthlyBookGenerator: Failed', customMonthlyBookId, err);
        await CustomMonthlyBook.findByIdAndUpdate(customMonthlyBookId, {
            status: 'failed',
            errorMessage: err.message || String(err),
        });
    }
}

module.exports = { runMonthlyBookGeneration };
