/**
 * Multi-day game tracks that unlock one step at a time.
 *
 * A step unlocks `unlockAfterHours` after the previous step's game was completed.
 * Each `gameId` must match a `Game.gameId` created in the portal; a track is ignored
 * until its games exist and are enabled, so tracks can ship before their content.
 */

const PROGRESSION_TRACKS = [
    {
        id: 'creation_week',
        name: 'Creation Week',
        url: '/#/games',
        unlockAfterHours: 18,
        // Don't nudge about an unlock if the previous step was finished this long ago; the child has moved on.
        staleAfterDays: 14,
        steps: [
            { day: 1, gameId: 'creation-day-1', theme: 'God made light' },
            { day: 2, gameId: 'creation-day-2', theme: 'God made the sky and the waters' },
            { day: 3, gameId: 'creation-day-3', theme: 'God made land, plants and trees' },
            { day: 4, gameId: 'creation-day-4', theme: 'God made the sun, moon and stars' },
            { day: 5, gameId: 'creation-day-5', theme: 'God made the fish and the birds' },
            { day: 6, gameId: 'creation-day-6', theme: 'God made the animals and people' },
            { day: 7, gameId: 'creation-day-7', theme: 'God rested' },
        ],
    },
];

module.exports = { PROGRESSION_TRACKS };
