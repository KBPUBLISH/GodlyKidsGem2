require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./src/models/Book');

const books = [
    {
        title: 'Level 1 Christian',
        coverImage: 'https://picsum.photos/seed/minecraft/400/400',
        minAge: 5,
        category: 'Activity Books',
        description: 'Journey into a game like adventure book! Help our main character discover the path to the pixel Kingdom.',
        author: 'Kingdom Builders Publishing',
        status: 'published'
    },
    {
        title: 'The Prince of the Hollow Kingdom',
        coverImage: 'https://picsum.photos/seed/prince/400/400',
        minAge: 5,
        category: 'Books Gone Free',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: "Paul's Worst Day Ever",
        coverImage: 'https://picsum.photos/seed/paul/400/400',
        minAge: 4,
        category: 'Bible Stories',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'The Boy Who Almost Had Everything',
        coverImage: 'https://picsum.photos/seed/boy/400/400',
        minAge: 4,
        category: 'Young Readers',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Grace and Lazar',
        coverImage: 'https://picsum.photos/seed/grace/400/500',
        minAge: 6,
        category: 'New Arrivals Books',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Noah and the Never-Ending Promise',
        coverImage: 'https://picsum.photos/seed/noah/400/400',
        minAge: 2,
        category: 'Young Readers',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Go Tales',
        coverImage: 'https://picsum.photos/seed/gotales/400/400',
        minAge: 0,
        category: 'Activity Books',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'The Lost Sheep Found',
        coverImage: 'https://picsum.photos/seed/sheep/400/400',
        minAge: 3,
        category: 'Bible Stories',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'David and the Giant',
        coverImage: 'https://picsum.photos/seed/goliath/400/400',
        minAge: 6,
        category: 'Books Gone Free',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Coloring Creation',
        coverImage: 'https://picsum.photos/seed/creation/400/400',
        minAge: 2,
        category: 'Activity Books',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Songs of Joy',
        coverImage: 'https://picsum.photos/seed/songs/400/400',
        minAge: 0,
        category: 'Young Readers',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'The Good Samaritan',
        coverImage: 'https://picsum.photos/seed/samaritan/400/400',
        minAge: 4,
        category: 'Books Gone Free',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Jungle Jam',
        coverImage: 'https://picsum.photos/seed/jungle/400/400',
        minAge: 3,
        category: 'Activity Books',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'Space Explorers: Faith Frontier',
        coverImage: 'https://picsum.photos/seed/space/400/400',
        minAge: 7,
        category: 'Activity Books',
        author: 'Unknown Author',
        status: 'published'
    },
    {
        title: 'The First Christmas',
        coverImage: 'https://picsum.photos/seed/xmas/400/400',
        minAge: 2,
        category: 'Young Readers',
        author: 'Unknown Author',
        status: 'published'
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        await Book.deleteMany({});
        console.log('🗑️  Cleared existing books');

        await Book.insertMany(books);
        console.log('🌱 Seeded database with initial books');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDB();
