/**
 * Island-building tips, tied to what the player has (and hasn't) built.
 * Building ids match the homeworld island game (homeworld/src/building.mjs): `oven` is the Starter Kitchen.
 * Order matters: the first applicable tip that hasn't been sent wins.
 */

const has = (island, id) => island.buildings.has(id);
const grewFood = (island) => has(island, 'garden') || island.harvestCount > 0;

const ISLAND_TIPS = [
    {
        id: 'starter_kitchen',
        applies: (island) => grewFood(island) && !has(island, 'oven'),
        title: '🍳 Did you know?',
        message: 'You can learn real recipes with the food you grow! Build your Starter Kitchen.',
    },
    {
        id: 'first_recipe',
        applies: (island) => has(island, 'oven') && island.cookedRecipeCount === 0,
        title: '👩‍🍳 Your kitchen is ready!',
        message: 'Cook your first recipe and serve it to your island friends.',
    },
    {
        id: 'garden_bed',
        applies: (island) => !has(island, 'garden') && (has(island, 'hut') || has(island, 'tent')),
        title: '🌱 Grow your own food',
        message: 'Plant a Garden Bed so your island friends have something yummy to eat!',
    },
    {
        id: 'water_well',
        applies: (island) => has(island, 'garden') && !has(island, 'well'),
        title: '💧 Thirsty plants?',
        message: 'Build a Water Well so your garden never goes dry.',
    },
    {
        id: 'market',
        applies: (island) => island.harvestCount >= 5 && !has(island, 'market'),
        title: '🛒 What a harvest!',
        message: 'You have grown lots of crops. Build a Market to share them with everyone!',
    },
    {
        id: 'church',
        applies: (island) => (has(island, 'hut') || has(island, 'cottage')) && !has(island, 'church'),
        title: '⛪ A place to worship',
        message: 'Build a Church where your island friends can gather to sing and pray.',
    },
];

module.exports = { ISLAND_TIPS };
