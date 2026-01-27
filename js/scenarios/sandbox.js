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
        goals: [],
        
        // World generation settings
        worldGen: {
            lakes: { min: 2, max: 4 },
            trees: { min: 10, max: 20 },
            startPathLength: 4
        },
        
        // All buildings available immediately (no unlock requirements)
        buildings: {
            // Paths
            'tiles':        { cost: 25,    run: 0,    cat: 'path',    name: 'Tiles' },
            'sand-path':    { cost: 30,    run: 0,    cat: 'path',    name: 'Sand' },
            'gravel-path':  { cost: 35,    run: 0,    cat: 'path',    name: 'Gravel' },
            'path':         { cost: 40,    run: 0,    cat: 'path',    name: 'Cobblestone' },
            'asphalt':      { cost: 50,    run: 0,    cat: 'path',    name: 'Asphalt' },
            'wooden-path':  { cost: 60,    run: 0,    cat: 'path',    name: 'Wooden' },
            
            // Rides - all unlocked
            'spiral-slide':      { cost: 1200,  run: 220,  cat: 'ride',    name: 'Spiral Slide' },
            'merry-go-round':    { cost: 1600,  run: 260,  cat: 'ride',    name: 'Carousel' },
            'ferris-wheel':      { cost: 2000,  run: 300,  cat: 'ride',    name: 'Ferris Wheel' },
            'haunted-house':     { cost: 2400,  run: 340,  cat: 'ride',    name: 'Haunted House' },
            'pirate-ship':       { cost: 2800,  run: 380,  cat: 'ride',    name: 'Pirate Ship' },
            'observation-tower': { cost: 3200,  run: 420,  cat: 'ride',    name: 'Observation Tower' },
            
            // Coasters - all unlocked
            'wild-mouse':      { cost: 4000,  run: 500,  cat: 'coaster', size: 2, name: 'Wild Mouse' },
            'junior-coaster':  { cost: 5000,  run: 600,  cat: 'coaster', size: 2, name: 'Junior Coaster' },
            'steel-coaster':   { cost: 7000,  run: 800,  cat: 'coaster', size: 2, name: 'Steel Coaster' },
            'wooden-coaster':  { cost: 8000,  run: 900,  cat: 'coaster', size: 2, name: 'Wooden Coaster' },
            'hyper-coaster':   { cost: 12000, run: 1300, cat: 'coaster', size: 2, name: 'Hyper Coaster' },
            'giga-coaster':    { cost: 15000, run: 1600, cat: 'coaster', size: 2, name: 'Giga Coaster' },
            
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
            guestEntryFee: 10,
            foodRevenuePerStall: 50,
            demolishCost: 50,
            guestGenDivisor: 2000,
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
        }
    };
    
})();
