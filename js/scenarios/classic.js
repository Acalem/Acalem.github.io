/**
 * Pixel Park Tycoon - Classic Scenario
 * The default game mode with progressive unlocks
 */

(function() {
    'use strict';
    
    PPT.scenarios.classic = {
        id: 'classic',
        name: 'Classic Park',
        description: 'Start with €4,500 and build your dream park from scratch. Unlock new attractions by reaching guest milestones.',
        icon: 'ferris-wheel',
        color: '#ff6b9d',
        
        // Starting conditions
        startMoney: 4500,
        startDay: 1,
        
        // Goals/Challenges (multi-condition)
        goals: [
            { name: 'First Steps',       icon: 'goal-build',   reward: 500,
              desc: 'Build 2 rides and 1 food stall',
              conditions: [{ type: 'buildings', cat: 'ride', min: 2 }, { type: 'buildings', cat: 'food', min: 1 }] },
            { name: 'Open for Business', icon: 'goal-ticket',  reward: 750,
              desc: 'Set entry fee \u2265 \u20ac5 and attract 10 guests',
              conditions: [{ type: 'entryFee', min: 5 }, { type: 'guests', min: 10 }] },
            { name: 'Staffing Up',       icon: 'goal-staff',   reward: 500,
              desc: 'Hire your first janitor',
              conditions: [{ type: 'staff', staffType: 'janitor', min: 1 }] },
            { name: 'Crowd Pleaser',     icon: 'goal-happy',   reward: 1000,
              desc: '50 guests with happiness above 60',
              conditions: [{ type: 'guests', min: 50 }, { type: 'happiness', min: 60 }] },
            { name: 'Thrill Capital',    icon: 'goal-coaster', reward: 1500,
              desc: 'Build 2 coasters and attract 150 guests',
              conditions: [{ type: 'buildings', cat: 'coaster', min: 2 }, { type: 'guests', min: 150 }] },
            { name: 'Five Star Park',    icon: 'goal-star',    reward: 2500,
              desc: 'Happiness 85 with 300 guests',
              conditions: [{ type: 'happiness', min: 85 }, { type: 'guests', min: 300 }] },
            { name: 'Theme Park Empire', icon: 'goal-crown',   reward: 4000,
              desc: '600 guests at once',
              conditions: [{ type: 'guests', min: 600 }] },
            { name: 'World Famous',      icon: 'goal-globe',   reward: 6000,
              desc: '1,200 guests at once',
              conditions: [{ type: 'guests', min: 1200 }] }
        ],
        
        // World generation settings
        worldGen: {
            lakes: { min: 3, max: 5 },
            trees: { min: 20, max: 30 },
            startPathLength: 4
        },
        
        // Daily running cost formula for rides & coasters:
        // baseRun = 50 + 6 * sqrt(buildCost)
        // dailyRun = round(baseRun / 5) * 5
        //
        // Rationale:
        // - Sublinear (concave) growth
        // - Two smaller rides cost more together than one big, but not linearly
        // - Midgame stays affordable
        // - Late game scales to ±2000 guests
        //
        // Food stalls: run = cost * 0.24 (unchanged)
        // Paths & decor: run = 0 (unchanged)
        
        // Buildings available in this scenario
        // unlock: null = always available, 'First Steps'/'Open for Business'/etc = requires that goal
        buildings: {
            // Paths (no running costs)
            'dirt-trail':    { cost: 15,    run: 0,   cat: 'path',    name: 'Dirt Trail' },
            'gravel-trail':  { cost: 20,    run: 0,   cat: 'path',    name: 'Gravel Trail' },
            'dirt-lane':     { cost: 30,    run: 0,   cat: 'path',    name: 'Country Lane' },
            'gravel-walk':   { cost: 35,    run: 0,   cat: 'path',    name: 'Garden Walk' },
            'stone-paving':  { cost: 45,    run: 0,   cat: 'path',    name: 'Stone Paving' },
            'tarmac':        { cost: 50,    run: 0,   cat: 'path',    name: 'Tarmac' },
            'park-walkway':  { cost: 70,    run: 0,   cat: 'path',    name: 'Park Walkway',   unlock: 'First Steps' },
            'park-road':     { cost: 80,    run: 0,   cat: 'path',    name: 'Park Road',      unlock: 'First Steps' },
            'promenade':     { cost: 100,   run: 0,   cat: 'path',    name: 'Promenade',      unlock: 'Open for Business' },
            'grand-avenue':  { cost: 120,   run: 0,   cat: 'path',    name: 'Grand Avenue',   unlock: 'Open for Business' },
            
            // Rides (run calculated with formula above)
            'spiral-slide':      { cost: 1200,  run: 260,  cat: 'ride',    name: 'Spiral Slide' },
            'merry-go-round':    { cost: 1600,  run: 290,  cat: 'ride',    name: 'Carousel' },
            'ferris-wheel':      { cost: 2000,  run: 320,  cat: 'ride',    name: 'Ferris Wheel' },
            'haunted-house':     { cost: 2400,  run: 345,  cat: 'ride',    name: 'Haunted House' },
            'pirate-ship':       { cost: 2800,  run: 370,  cat: 'ride',    name: 'Pirate Ship',       unlock: 'First Steps' },
            'observation-tower': { cost: 3200,  run: 390,  cat: 'ride',    name: 'Observation Tower', unlock: 'Open for Business' },
            
            // Coasters (run calculated with formula above)
            'wild-mouse':      { cost: 4000,  run: 430,  cat: 'coaster', size: 2, name: 'Wild Mouse' },
            'junior-coaster':  { cost: 5000,  run: 475,  cat: 'coaster', size: 2, name: 'Junior Coaster' },
            'steel-coaster':   { cost: 7000,  run: 550,  cat: 'coaster', size: 2, name: 'Steel Coaster' },
            'wooden-coaster':  { cost: 8000,  run: 585,  cat: 'coaster', size: 2, name: 'Wooden Coaster' },
            'hyper-coaster':   { cost: 12000, run: 705,  cat: 'coaster', size: 2, name: 'Hyper Coaster',  unlock: 'Thrill Capital' },
            'giga-coaster':    { cost: 15000, run: 785,  cat: 'coaster', size: 2, name: 'Giga Coaster',   unlock: 'Five Star Park' },
            
            // Food (run = cost * 0.24, unchanged)
            'cotton-candy':  { cost: 600,  run: 144, cat: 'food', name: 'Cotton Candy' },
            'coffee-stand':  { cost: 800,  run: 192, cat: 'food', name: 'Coffee Stand' },
            'ice-cream':     { cost: 1200, run: 288, cat: 'food', name: 'Ice Cream' },
            'soft-drinks':   { cost: 1200, run: 288, cat: 'food', name: 'Soft Drinks' },
            'waffles':       { cost: 1200, run: 288, cat: 'food', name: 'Waffles',      unlock: 'First Steps' },
            'burger-joint':  { cost: 1800, run: 432, cat: 'food', name: 'Burger Joint', unlock: 'Open for Business' },
            
            // Decor (no running costs)
            'bush':        { cost: 100, run: 0, cat: 'decor', name: 'Bush' },
            'hedge':       { cost: 100, run: 0, cat: 'decor', name: 'Hedge' },
            'flowers':     { cost: 100, run: 0, cat: 'decor', name: 'Flowers' },
            'water':       { cost: 150, run: 0, cat: 'decor', name: 'Water' },
            'tree-oak':    { cost: 200, run: 0, cat: 'decor', name: 'Oak Tree',    unlock: 'First Steps' },
            'tree-pine':   { cost: 200, run: 0, cat: 'decor', name: 'Pine Tree',   unlock: 'First Steps' },
            'tree-cherry': { cost: 250, run: 0, cat: 'decor', name: 'Cherry Tree', unlock: 'Open for Business' },
            'statue':      { cost: 500, run: 0, cat: 'decor', name: 'Statue',      unlock: 'Thrill Capital' },
            'fountain':    { cost: 800, run: 0, cat: 'decor', name: 'Fountain',    unlock: 'Five Star Park' }
        },
        
        // Economy formulas
        economy: {
            foodRevenuePerStall: 30,     // € per food stall per tick, capped by guest count
            sellRefundRate: 0.6,         // 60% of build cost back when selling
            // Guest generation: log(1 + totalAttractionCost / divisor) * happiness * timeMult * priceMod * crowdFactor
            guestGenDivisor: 1700,
            // Fair price elasticity
            fairPriceBase: 8,            // Base fair price with no attractions
            fairPriceScale: 0.15,        // Scale factor * sqrt(attrCost)
            maxGuestsDivisor: 30,        // Guest cap = attrCost / this
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
        },
        
        // Staff types
        staff: {
            janitor:     { name: 'Janitor',     icon: 'staff-janitor',     color: '#5da6ff',
                           cost: 150, salary: 30, effect: 'cleanliness', maxCount: 10 },
            mechanic:    { name: 'Mechanic',    icon: 'staff-mechanic',    color: '#ff9c52',
                           cost: 250, salary: 50, effect: 'reliability', maxCount: 8,
                           unlock: 'Staffing Up' },
            entertainer: { name: 'Entertainer', icon: 'staff-entertainer', color: '#c7a4f6',
                           cost: 200, salary: 40, effect: 'fun', maxCount: 6,
                           unlock: 'Staffing Up' }
        }
    };
    
})();
