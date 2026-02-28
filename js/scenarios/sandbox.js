/**
 * Pixel Park Tycoon - Sandbox Scenario
 * Unlimited money, all buildings unlocked from start
 */

(function() {
    'use strict';
    
    PPT.scenarios.sandbox = {
        id: 'sandbox',
        name: 'Sandbox Mode',
        description: 'Unlimited money and all attractions unlocked. Build freely without restrictions. Perfect for creativity!',
        icon: 'hammer',
        color: '#6bcb77',
        
        // Starting conditions - lots of money!
        startMoney: 999999,
        startDay: 1,
        
        // No goals in sandbox - just build!
        goals: [
            { name: 'Tiny Park',       icon: 'goal-tiny',    reward: 0, desc: 'Get 20 guests using 10 or fewer tiles',
              conditions: [{ type: 'guests', min: 20 }, { type: 'maxTiles', max: 10 }] },
            { name: 'Coaster Fanatic', icon: 'goal-coaster', reward: 0, desc: 'Build one of every coaster',
              conditions: [{ type: 'buildingsExact', types: ['wild-mouse','junior-coaster','steel-coaster','wooden-coaster','hyper-coaster','giga-coaster'] }] },
            { name: 'Food Court',      icon: 'goal-foodie',  reward: 0, desc: 'Build one of every food stall',
              conditions: [{ type: 'buildingsExact', types: ['cotton-candy','coffee-stand','ice-cream','soft-drinks','waffles','burger-joint'] }] },
            { name: 'Garden Paradise',  icon: 'goal-garden',  reward: 0, desc: 'Place 30 decorations',
              conditions: [{ type: 'buildings', cat: 'decor', min: 30 }] },
            { name: 'Full House',       icon: 'goal-crowd',   reward: 0, desc: '500 guests at once',
              conditions: [{ type: 'guests', min: 500 }] },
            { name: 'Bliss',            icon: 'goal-happy',   reward: 0, desc: 'Reach 100 happiness',
              conditions: [{ type: 'happiness', min: 100 }] },
            { name: 'Perfectionist',    icon: 'goal-globe',   reward: 0, desc: 'Fill every buildable tile',
              conditions: [{ type: 'allTilesFilled' }] }
        ],
        
        // World generation settings
        worldGen: {
            lakes: { min: 2, max: 4 },
            trees: { min: 10, max: 20 },
            startPathLength: 4
        },
        
        // All buildings available immediately (no unlock requirements)
        buildings: {
            // Paths
            'dirt-trail':    { cost: 15,    run: 0,   cat: 'path',    name: 'Dirt Trail' },
            'gravel-trail':  { cost: 20,    run: 0,   cat: 'path',    name: 'Gravel Trail' },
            'dirt-lane':     { cost: 30,    run: 0,   cat: 'path',    name: 'Country Lane' },
            'gravel-walk':   { cost: 35,    run: 0,   cat: 'path',    name: 'Garden Walk' },
            'stone-paving':  { cost: 45,    run: 0,   cat: 'path',    name: 'Stone Paving' },
            'tarmac':        { cost: 50,    run: 0,   cat: 'path',    name: 'Tarmac' },
            'park-walkway':  { cost: 70,    run: 0,   cat: 'path',    name: 'Park Walkway' },
            'park-road':     { cost: 80,    run: 0,   cat: 'path',    name: 'Park Road' },
            'promenade':     { cost: 100,   run: 0,   cat: 'path',    name: 'Promenade' },
            'grand-avenue':  { cost: 120,   run: 0,   cat: 'path',    name: 'Grand Avenue' },
            
            // Rides - all unlocked
            'spiral-slide':      { cost: 1200,  run: 220,  cat: 'ride',    name: 'Spiral Slide',      time: 5,  capacity: 8 },
            'merry-go-round':    { cost: 1600,  run: 260,  cat: 'ride',    name: 'Carousel',          time: 8,  capacity: 14 },
            'ferris-wheel':      { cost: 2000,  run: 300,  cat: 'ride',    name: 'Ferris Wheel',      time: 12, capacity: 16 },
            'haunted-house':     { cost: 2400,  run: 340,  cat: 'ride',    name: 'Haunted House',     time: 10, capacity: 10 },
            'pirate-ship':       { cost: 2800,  run: 380,  cat: 'ride',    name: 'Pirate Ship',       time: 8,  capacity: 20 },
            'observation-tower': { cost: 3200,  run: 420,  cat: 'ride',    name: 'Observation Tower', time: 10, capacity: 12 },
            
            // Coasters - all unlocked
            'wild-mouse':      { cost: 4000,  run: 500,  cat: 'coaster', size: 2, name: 'Wild Mouse',     time: 8,  capacity: 12 },
            'junior-coaster':  { cost: 5000,  run: 600,  cat: 'coaster', size: 2, name: 'Junior Coaster', time: 10, capacity: 18 },
            'steel-coaster':   { cost: 7000,  run: 800,  cat: 'coaster', size: 2, name: 'Steel Coaster',  time: 12, capacity: 24 },
            'wooden-coaster':  { cost: 8000,  run: 900,  cat: 'coaster', size: 2, name: 'Wooden Coaster', time: 14, capacity: 24 },
            'hyper-coaster':   { cost: 12000, run: 1300, cat: 'coaster', size: 2, name: 'Hyper Coaster',  time: 16, capacity: 32 },
            'giga-coaster':    { cost: 15000, run: 1600, cat: 'coaster', size: 2, name: 'Giga Coaster',   time: 18, capacity: 40 },
            
            // Food - all unlocked
            'cotton-candy':  { cost: 600,  run: 144, cat: 'food', name: 'Cotton Candy' },
            'coffee-stand':  { cost: 800,  run: 192, cat: 'food', name: 'Coffee Stand' },
            'ice-cream':     { cost: 1200, run: 288, cat: 'food', name: 'Ice Cream' },
            'soft-drinks':   { cost: 1200, run: 288, cat: 'food', name: 'Soft Drinks' },
            'waffles':       { cost: 1200, run: 288, cat: 'food', name: 'Waffles' },
            'burger-joint':  { cost: 1800, run: 432, cat: 'food', name: 'Burger Joint' },
            
            // Decor - all unlocked
            'bush':        { cost: 100, run: 0, cat: 'decor', name: 'Bush' },
            'hedge':       { cost: 100, run: 0, cat: 'decor', name: 'Hedge' },
            'flowers':     { cost: 100, run: 0, cat: 'decor', name: 'Flowers' },
            'water':       { cost: 150, run: 0, cat: 'decor', name: 'Water' },
            'tree-oak':    { cost: 200, run: 0, cat: 'decor', name: 'Oak Tree' },
            'tree-pine':   { cost: 200, run: 0, cat: 'decor', name: 'Pine Tree' },
            'tree-cherry': { cost: 250, run: 0, cat: 'decor', name: 'Cherry Tree' },
            'statue':      { cost: 500, run: 0, cat: 'decor', name: 'Statue' },
            'fountain':    { cost: 800, run: 0, cat: 'decor', name: 'Fountain' }
        },
        
        // Economy - same as classic
        economy: {
            foodRevenuePerStall: 30,
            demolishCost: 50,
            guestGenDivisor: 2000,
            fairPriceBase: 8,
            fairPriceScale: 0.15,
            maxGuestsDivisor: 30,
            foodPerGuests: 50,
            ridesPerGuests: 75,
            pathsPerGuests: 20,
            decorPerGuests: 100
        },
        
        // Time multipliers
        timeMultipliers: {
            morning: 1.0,
            afternoon: 0.6,
            evening: 0.2,
            night: 0,
            weekendBonus: 1.5
        },
        
        // Boosts
        boosts: {
            ride: { amount: 10, ticks: 42 },
            coaster: { amount: 15, ticks: 84 },
            food: { amount: 10, ticks: 42 },
            goal: { amount: 20, ticks: 42 }
        },
        
        // Staff types (all available)
        staff: {
            janitor:     { name: 'Janitor',     icon: 'staff-janitor',     color: '#5da6ff',
                           cost: 150, salary: 30, effect: 'cleanliness', maxCount: 10 },
            mechanic:    { name: 'Mechanic',    icon: 'staff-mechanic',    color: '#ff9c52',
                           cost: 250, salary: 50, effect: 'reliability', maxCount: 8 },
            entertainer: { name: 'Entertainer', icon: 'staff-entertainer', color: '#c7a4f6',
                           cost: 200, salary: 40, effect: 'fun', maxCount: 6 }
        }
    };
    
})();
