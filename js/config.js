/**
 * Pixel Park Paradise - Configuration
 * Game constants, color palette, and base definitions
 */

(function() {
    'use strict';
    
    // Grid and tile settings
    PPT.config.TILE_SIZE = 32;
    PPT.config.GRID_WIDTH = 20;
    PPT.config.GRID_HEIGHT = 12;
    
    // Day/time settings
    PPT.config.TICKS_PER_DAY = 156;
    PPT.config.DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Day period boundaries (as percentage of TICKS_PER_DAY)
    // night(0-4%) -> morning(4-35%) -> afternoon(35-65%) -> evening(65-96%) -> night(96-100%)
    PPT.config.DAY_PERIODS = {
        night1End: 0.038,      // ~6 ticks at 156
        morningEnd: 0.346,    // ~54 ticks at 156 (2x longer)
        afternoonEnd: 0.654,  // ~102 ticks at 156 (2x longer)
        eveningEnd: 0.962     // ~150 ticks at 156 (2x longer)
    };
    
    // Helper function to get period boundaries in ticks
    PPT.config.getPeriodTicks = function() {
        var tpd = PPT.config.TICKS_PER_DAY;
        var dp = PPT.config.DAY_PERIODS;
        return {
            night1End: Math.floor(tpd * dp.night1End),
            morningEnd: Math.floor(tpd * dp.morningEnd),
            afternoonEnd: Math.floor(tpd * dp.afternoonEnd),
            eveningEnd: Math.floor(tpd * dp.eveningEnd)
        };
    };
    
    // Helper function to get current day period from tick
    PPT.config.getDayPeriod = function(tick) {
        var t = tick % PPT.config.TICKS_PER_DAY;
        var p = PPT.config.getPeriodTicks();
        if (t < p.night1End) return 'night';
        if (t < p.morningEnd) return 'morning';
        if (t < p.afternoonEnd) return 'afternoon';
        if (t < p.eveningEnd) return 'evening';
        return 'night';
    };
    
    // Guest skin tones (8 variations)
    PPT.config.SKIN_COLORS = ['#fde0c8', '#f5d0a9', '#e8b88a', '#dba97a', '#c68642', '#a86b32', '#8d5524', '#5c3310'];
    PPT.config.HAIR_COLORS = ['#6c5043', '#3c2820', '#ffe94d', '#ff7b7b', '#2a2a3e', '#9b6a3b'];
    // 8 outfit color combos: [shirtColor, pantsColor]
    PPT.config.OUTFIT_COMBOS = [
        ['#5da6ff', '#3d5a80'], // blue + navy
        ['#ff7b7b', '#4a4a5a'], // red + dark grey
        ['#7bdb87', '#8a7a50'], // green + khaki
        ['#ffe94d', '#6b5335'], // yellow + brown
        ['#c7a4f6', '#5a4570'], // purple + dark purple
        ['#ff7dad', '#6a6a7a'], // pink + grey
        ['#ff9c52', '#2e4057'], // orange + navy
        ['#5ce0d6', '#2a6060']  // teal + dark teal
    ];
    PPT.config.BODY_TYPES = ['man', 'woman', 'boy', 'girl'];
    
    // Color palette (C)
    PPT.config.C = {
        // Grass
        grass1: '#7ed687',
        grass2: '#76d180',
        grassDark: '#5cb866',
        grassLight: '#9de8a5',
        
        // Paths
        path1: '#e8dcc8',
        path2: '#e0d4c0',
        path3: '#d8ccb8',
        path4: '#d0c4b0',
        
        // Asphalt
        asphalt1: '#9cb8c0',
        asphalt2: '#8aa8b0',
        asphalt3: '#aac8d0',
        
        // Wood
        wood1: '#c49a6c',
        wood2: '#b48a5c',
        wood3: '#d4aa7c',
        
        // Sand
        sand1: '#e8d8a8',
        sand2: '#d8c898',
        sand3: '#f0e0b0',
        
        // Gravel
        gravel1: '#a0a0a0',
        gravel2: '#909090',
        gravel3: '#b0b0b0',
        
        // Trees
        tree1: '#3d8a47',
        tree2: '#4d9a57',
        tree3: '#5daa67',
        tree4: '#6dba77',
        trunk: '#9b6a3b',
        trunkDark: '#7b5a2b',
        
        // Water
        water1: '#6dd5f7',
        water2: '#5dc5e7',
        waterLight: '#b3e5fc',
        
        // Bush/Hedge
        bush1: '#5aae6a',
        bush2: '#4d9e5d',
        bush4: '#6dbe7a',
        hedge1: '#3d8a47',
        hedge2: '#4d9a57',
        hedge3: '#2d7a37',
        
        // Accent colors
        pink: '#ff7dad',
        orange: '#ff9c52',
        yellow: '#ffe94d',
        purple: '#c7a4f6',
        blue: '#84d7fc',
        white: '#fff8f0',
        red: '#ff7b7b',
        dblue: '#5da6ff',
        green: '#7bdb87',
        
        // Special
        haunted: '#5a4a6a',
        hauntedDark: '#3a2a4a',
        nightSky: '#0a0a1a'
    };
    
    // Path types that count as walkable
    PPT.config.PATH_TYPES = ['dirt-trail', 'gravel-trail', 'dirt-lane', 'gravel-walk', 'stone-paving', 'tarmac', 'park-walkway', 'park-road', 'promenade', 'grand-avenue', 'entrance'];
    
    // Guest types - park composition drives type distribution
    PPT.config.GUEST_TYPES = {
        thrillSeeker: { label: 'Thrill Seeker', icon: 'guest-thrill', color: '#ff7b7b',
                        preference: 'coaster', spendMult: 0.5, driver: 'coaster',
                        pref: 'Loves big thrills, skips the food' },
        foodie:       { label: 'Foodie',        icon: 'guest-foodie', color: '#ff9c52',
                        preference: 'food',    spendMult: 2.5, driver: 'food',
                        pref: 'Here for the food, big spender' },
        family:       { label: 'Family',        icon: 'guest-family', color: '#7bdb87',
                        preference: 'ride',    spendMult: 1.2, driver: 'ride',
                        pref: 'Enjoys more gentle rides' },
        vip:          { label: 'VIP',           icon: 'guest-vip',    color: '#ffd93d',
                        preference: 'decor',   spendMult: 2.0, driver: 'decor',
                        pref: 'Appreciates a beautiful park' }
    };
    
    PPT.config.GUEST_NAMES = [
        'Alex','Sam','Max','Jo','Robin','Kai','Lou','Finn','Mia','Zoe','Lily','Eva',
        'Noa','Ava','Ida','Ivy','Leo','Tom','Ben','Eli','Luca','Nico','Hugo','Otto',
        'Ruby','Luna','Jade','Iris','Cleo','Rosa','Tim','Nora','Ollie','Milo','Jack',
        'Theo','Noah','Liam','Carlijn','Axel','Emma','Sora','Yuki','Aria','Maya','Tess',
        'Cara','Wren','Felix','Oscar','Marco','Dante','Elsa','Greta','Hana','Piper',
        'Jasper','Casper','Rowan','Quinn','Blair','Sage','Fern','Bea'
    ];
    
    // Tree types for world generation
    PPT.config.TREE_TYPES = ['tree-oak', 'tree-pine', 'tree-cherry'];
    
    // ==================== BEHAVIOR SYSTEM CONFIG ====================
    
    // Food stall product definitions: food_type and product_price
    PPT.config.FOOD_PRODUCTS = {
        'cotton-candy':  { food_type: 'food',  product_price: 5, name: 'Cotton Candy' },
        'coffee-stand':  { food_type: 'drink', product_price: 4, name: 'Coffee' },
        'ice-cream':     { food_type: 'food',  product_price: 6, name: 'Ice Cream' },
        'soft-drinks':   { food_type: 'drink', product_price: 3, name: 'Soft Drink' },
        'waffles':       { food_type: 'food',  product_price: 7, name: 'Waffle' },
        'burger-joint':  { food_type: 'food',  product_price: 9, name: 'Burger' }
    };
    
    // Capacity formula: how many guests can be inside at once
    PPT.config.getCapacity = function(type, cost) {
        var scenario = PPT.currentScenario;
        if (scenario && scenario.buildings[type]) {
            var d = scenario.buildings[type];
            // Use explicit capacity if defined
            if (d.capacity != null) return d.capacity;
            var cat = d.cat;
            if (cat === 'coaster') return Math.max(4, Math.floor(cost / 800));
            if (cat === 'ride')    return Math.max(3, Math.floor(cost / 400));
            if (cat === 'food')    return Math.max(2, Math.floor(cost / 400));
        }
        return 1;
    };
    
    // Popularity: freshness multiplier based on ticks since built
    PPT.config.FRESHNESS_TABLE = [
        { maxTicks: 50,  mult: 1.5 },
        { maxTicks: 200, mult: 1.2 },
        { maxTicks: 500, mult: 1.0 }
        // 500+ defaults to 0.8
    ];
    
    // Behavior system constants
    PPT.config.BEHAVIOR = {
        visitorRatio: 0.85,          // 85% visitors, 15% wanderers
        wishlistMin: 2,
        wishlistMax: 4,
        hungerMin: 0,
        hungerMax: 25,
        thirstMin: 0,
        thirstMax: 30,
        hungerThreshMin: 70,
        hungerThreshMax: 85,
        thirstThreshMin: 65,
        thirstThreshMax: 80,
        hungerRateMin: 0.25,
        hungerRateMax: 0.4,
        thirstRateMin: 0.3,
        thirstRateMax: 0.5
    };
    
})();
