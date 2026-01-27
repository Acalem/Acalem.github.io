/**
 * Pixel Park Tycoon - Classic Scenario
 * The default game mode with progressive unlocks
 */

(function() {
    'use strict';
    
    PPT.scenarios.classic = {
        id: 'classic',
        name: 'Classic Park',
        description: 'Start with €5,000 and build your dream park from scratch. Unlock new attractions by reaching guest milestones.',
        icon: 'ferris-wheel',
        color: '#ff6b9d',
        
        // Starting conditions
        startMoney: 5000,
        startDay: 1,
        
        // Goals/Challenges
        goals: [
            { name: 'Bronze',   guests: 250,  reward: 400 },
            { name: 'Silver',   guests: 1000, reward: 1000 },
            { name: 'Gold',     guests: 2000, reward: 2000 },
            { name: 'Platinum', guests: 2500, reward: 2500 },
            { name: 'Diamond',  guests: 3000, reward: 3000 }
        ],
        
        // World generation settings
        worldGen: {
            lakes: { min: 3, max: 5 },
            trees: { min: 20, max: 30 },
            startPathLength: 4
        },
        
        // Buildings available in this scenario
        // unlock: null = always available, 'Bronze'/'Silver'/etc = requires that goal
        buildings: {
            // Paths
            'tiles':        { cost: 25,    run: 0,    cat: 'path',    name: 'Tiles' },
            'sand-path':    { cost: 30,    run: 0,    cat: 'path',    name: 'Sand' },
            'gravel-path':  { cost: 35,    run: 0,    cat: 'path',    name: 'Gravel' },
            'path':         { cost: 40,    run: 0,    cat: 'path',    name: 'Cobblestone' },
            'asphalt':      { cost: 50,    run: 0,    cat: 'path',    name: 'Asphalt',    unlock: 'Bronze' },
            'wooden-path':  { cost: 60,    run: 0,    cat: 'path',    name: 'Wooden',     unlock: 'Silver' },
            
            // Rides (run = cost * 0.1 + 100)
            'spiral-slide':      { cost: 1200,  run: 220,  cat: 'ride',    name: 'Spiral Slide' },
            'merry-go-round':    { cost: 1600,  run: 260,  cat: 'ride',    name: 'Carousel' },
            'ferris-wheel':      { cost: 2000,  run: 300,  cat: 'ride',    name: 'Ferris Wheel' },
            'haunted-house':     { cost: 2400,  run: 340,  cat: 'ride',    name: 'Haunted House' },
            'pirate-ship':       { cost: 2800,  run: 380,  cat: 'ride',    name: 'Pirate Ship',       unlock: 'Bronze' },
            'observation-tower': { cost: 3200,  run: 420,  cat: 'ride',    name: 'Observation Tower', unlock: 'Silver' },
            
            // Coasters (run = cost * 0.1 + 100)
            'wild-mouse':      { cost: 4000,  run: 500,  cat: 'coaster', size: 2, name: 'Wild Mouse' },
            'junior-coaster':  { cost: 5000,  run: 600,  cat: 'coaster', size: 2, name: 'Junior Coaster' },
            'steel-coaster':   { cost: 7000,  run: 800,  cat: 'coaster', size: 2, name: 'Steel Coaster' },
            'wooden-coaster':  { cost: 8000,  run: 900,  cat: 'coaster', size: 2, name: 'Wooden Coaster' },
            'hyper-coaster':   { cost: 12000, run: 1300, cat: 'coaster', size: 2, name: 'Hyper Coaster',  unlock: 'Gold' },
            'giga-coaster':    { cost: 15000, run: 1600, cat: 'coaster', size: 2, name: 'Giga Coaster',   unlock: 'Platinum' },
            
            // Food
            'cotton-candy':  { cost: 600,  run: 144, cat: 'food', name: 'Cotton Candy' },
            'coffee-stand':  { cost: 800,  run: 192, cat: 'food', name: 'Coffee Stand' },
            'ice-cream':     { cost: 1200, run: 288, cat: 'food', name: 'Ice Cream' },
            'soft-drinks':   { cost: 1200, run: 288, cat: 'food', name: 'Soft Drinks' },
            'waffles':       { cost: 1200, run: 288, cat: 'food', name: 'Waffles',      unlock: 'Bronze' },
            'burger-joint':  { cost: 1800, run: 432, cat: 'food', name: 'Burger Joint', unlock: 'Silver' },
            
            // Decor
            'bush':        { cost: 100, run: 0, cat: 'decor', name: 'Bush' },
            'hedge':       { cost: 100, run: 0, cat: 'decor', name: 'Hedge' },
            'flowers':     { cost: 100, run: 0, cat: 'decor', name: 'Flowers' },
            'water':       { cost: 150, run: 0, cat: 'decor', name: 'Water' },
            'tree-oak':    { cost: 200, run: 0, cat: 'decor', name: 'Oak Tree',    unlock: 'Bronze' },
            'tree-pine':   { cost: 200, run: 0, cat: 'decor', name: 'Pine Tree',   unlock: 'Bronze' },
            'tree-cherry': { cost: 250, run: 0, cat: 'decor', name: 'Cherry Tree', unlock: 'Silver' },
            'statue':      { cost: 500, run: 0, cat: 'decor', name: 'Statue',      unlock: 'Gold' },
            'fountain':    { cost: 800, run: 0, cat: 'decor', name: 'Fountain',    unlock: 'Platinum' }
        },
        
        // Economy formulas
        economy: {
            guestEntryFee: 10,           // € per guest entering
            foodRevenuePerStall: 50,     // € per food stall per tick, capped by guest count
            demolishCost: 50,
            // Guest generation: log(1 + totalAttractionCost / divisor) * (happiness/100) * timeMult * weekendBonus
            guestGenDivisor: 2000,
            // Happiness thresholds
            foodPerGuests: 50,           // 1 food stall per X guests
            ridesPerGuests: 75,          // 1 ride/coaster per X guests  
            pathsPerGuests: 20,          // 1 path per X guests
            decorPerGuests: 100          // 1 decor per X guests
        },
        
        // Time multipliers
        timeMultipliers: {
            morning: 1.0,
            afternoon: 0.6,
            evening: 0.2,
            night: 0,
            weekendBonus: 1.5
        },
        
        // Boost settings (temporary happiness boosts)
        boosts: {
            ride: { amount: 10, ticks: 42 },
            coaster: { amount: 15, ticks: 84 },
            food: { amount: 10, ticks: 42 },
            goal: { amount: 20, ticks: 42 }
        }
    };
    
})();
