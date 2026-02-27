/**
 * Pixel Park Paradise - Game Logic
 * Core game mechanics, economy, and building placement
 */

(function() {
    'use strict';
    
    const TILE_SIZE = PPT.config.TILE_SIZE;
    const GRID_WIDTH = PPT.config.GRID_WIDTH;
    const GRID_HEIGHT = PPT.config.GRID_HEIGHT;
    const C = PPT.config.C;
    
    // ===== PERFORMANCE: Cached path set for guest movement =====
    // Only rebuilt when the grid changes (tracked via PPT.render._gridVersion).
    var _cachedPathSet = {};
    var _pathSetVersion = -1;
    
    function getPathSet() {
        var gv = PPT.render._gridVersion;
        if (_pathSetVersion === gv) return _cachedPathSet;
        _pathSetVersion = gv;
        _cachedPathSet = {};
        for (var y = 0; y < GRID_HEIGHT; y++) {
            for (var x = 0; x < GRID_WIDTH; x++) {
                var t = G.grid[y][x] ? G.grid[y][x].type : null;
                if (PPT.config.PATH_TYPES.includes(t)) _cachedPathSet[x + ',' + y] = true;
            }
        }
        return _cachedPathSet;
    }
    
    // ===== PERFORMANCE: Throttle food stall BFS lookups =====
    // Guests only re-search for food every N frames instead of every frame.
    var FOOD_SEARCH_COOLDOWN = 30; // ~0.5s at 60fps
    
    // ==================== FINANCE TRACKING ====================
    
    PPT.game.trackFinance = function(category, amount) {
        if (!G.todayFinances) G.todayFinances = { entryFees: 0, foodRevenue: 0, runningCosts: 0, staffSalaries: 0, construction: 0, events: 0, rewards: 0 };
        if (G.todayFinances[category] !== undefined) G.todayFinances[category] += amount;
    };
    
    // ==================== WORLD GENERATION ====================
    
    PPT.game.generateWorld = function() {
        const scenario = PPT.currentScenario;
        G.worldSeed = Date.now();
        G.grid = [];
        
        // Initialize empty grid
        for (let y = 0; y < GRID_HEIGHT; y++) {
            G.grid[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) G.grid[y][x] = null;
        }
        
        // Generate lakes
        const wg = scenario.worldGen;
        const lakeCount = wg.lakes.min + Math.floor(PPT.utils.seededRandom(G.worldSeed) * (wg.lakes.max - wg.lakes.min + 1));
        for (let l = 0; l < lakeCount; l++) {
            let lx, ly, att = 0;
            do {
                lx = 3 + Math.floor(PPT.utils.seededRandom(G.worldSeed + l * 100 + att) * (GRID_WIDTH - 6));
                ly = 1 + Math.floor(PPT.utils.seededRandom(G.worldSeed + l * 100 + 50 + att) * (GRID_HEIGHT - 3));
                att++;
            } while (att < 20 && (ly === 5 && lx < 4));
            
            if (G.grid[ly][lx] === null) {
                G.grid[ly][lx] = { type: 'water', natural: true };
                if (PPT.utils.seededRandom(G.worldSeed + l * 200) > 0.5 && lx + 1 < GRID_WIDTH && G.grid[ly][lx + 1] === null) {
                    G.grid[ly][lx + 1] = { type: 'water', natural: true };
                }
            }
        }
        
        // Generate trees
        const treeTypes = PPT.config.TREE_TYPES;
        const treeCount = wg.trees.min + Math.floor(PPT.utils.seededRandom(G.worldSeed + 1000) * (wg.trees.max - wg.trees.min + 1));
        for (let t = 0; t < treeCount; t++) {
            let tx, ty, att = 0;
            do {
                tx = Math.floor(PPT.utils.seededRandom(G.worldSeed + t * 100 + 2000) * GRID_WIDTH);
                ty = Math.floor(PPT.utils.seededRandom(G.worldSeed + t * 100 + 2050) * GRID_HEIGHT);
                att++;
            } while (att < 20 && (G.grid[ty][tx] !== null || (ty === 5 && tx < 4)));
            
            if (G.grid[ty][tx] === null) {
                G.grid[ty][tx] = {
                    type: treeTypes[Math.floor(PPT.utils.seededRandom(G.worldSeed + t * 100 + 3000) * 3)],
                    sway: PPT.utils.seededRandom(G.worldSeed + t) * Math.PI * 2,
                    natural: true
                };
            }
        }
        
        // Place entrance and starting path
        G.grid[5][0] = { type: 'entrance', perm: true };
        for (let i = 1; i <= wg.startPathLength; i++) {
            G.grid[5][i] = { type: 'promenade' };
        }
        
        // Initialize buildings list
        G.buildings = [{ type: 'entrance', x: 0, y: 5, builtTick: 0, current_visitors: 0, sales_today: 0, revenue_today: 0 }];
        for (let i = 1; i <= wg.startPathLength; i++) {
            G.buildings.push({ type: 'promenade', x: i, y: 5, builtTick: 0, current_visitors: 0, sales_today: 0, revenue_today: 0 });
        }
        
        // Initialize birds and effects
        PPT.game.initBirds();
        G.leaves = [];
        G.sparkles = [];
    };
    
    /**
     * Initialize birds (called separately when loading a save)
     */
    PPT.game.initBirds = function() {
        const C = PPT.config.C;
        G.birds = [];
        for (let i = 0; i < 4; i++) {
            G.birds.push({
                x: Math.random() * 640,
                y: 20 + Math.random() * 80,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.15,
                wing: Math.random() * Math.PI * 2,
                color: [C.trunk, C.red, C.dblue, C.purple][i % 4],
                size: 3 + Math.random() * 2
            });
        }
        G.leaves = [];
        G.sparkles = [];
    };
    
    // ==================== ECONOMY ====================
    
    PPT.game.countBuildings = function() {
        const scenario = PPT.currentScenario;
        let rides = 0, coasters = 0, food = 0, decor = 0, paths = 0, run = 0, attrCost = 0;
        var breakdowns = G.rideBreakdowns || [];
        var powerOut = PPT.events ? PPT.events.isPowerOutage() : false;
        
        G.buildings.forEach(b => {
            if (b.building) return; // skip under construction
            const d = scenario.buildings[b.type];
            if (!d) return;
            if (d.cat === 'ride') {
                rides++;
                if (!powerOut) {
                    var broken = breakdowns.some(function(bd) { return bd.x === b.x && bd.y === b.y; });
                    if (!broken) attrCost += d.cost;
                }
            }
            else if (d.cat === 'coaster') {
                coasters++;
                if (!powerOut) {
                    var broken2 = breakdowns.some(function(bd) { return bd.x === b.x && bd.y === b.y; });
                    if (!broken2) attrCost += d.cost;
                }
            }
            else if (d.cat === 'food') food++;
            else if (d.cat === 'decor') decor++;
            else if (d.cat === 'path') paths++;
            run += d.run || 0;
        });
        
        return { rides, coasters, food, decor, paths, run, attrCost };
    };
    
    PPT.game.calcHappiness = function() {
        const scenario = PPT.currentScenario;
        const eco = scenario.economy;
        const c = PPT.game.countBuildings();
        const g = G.guests;
        let h = 0;
        
        if (g === 0 || c.food >= Math.ceil(g / eco.foodPerGuests)) h += 20;
        if (g === 0 || (c.rides + c.coasters) >= Math.ceil(g / eco.ridesPerGuests)) h += 30;
        if (g === 0 || c.paths >= Math.ceil(g / eco.pathsPerGuests)) h += 15;
        if (g === 0 || c.decor >= Math.ceil(g / eco.decorPerGuests)) h += 5;
        
        let boost = 0;
        G.boosts.forEach(b => boost += b.amt);
        
        // Cleanliness penalty (replaces staleness)
        var cleanPenalty = 0;
        if (G.cleanliness < 50) {
            cleanPenalty = -(50 - G.cleanliness) / 2;
        }
        
        // Entertainer bonus (+3 each)
        var entertainerBonus = 0;
        if (scenario.staff && G.staff) {
            entertainerBonus = G.staff.filter(function(s) { return s.type === 'entertainer'; }).length * 3;
        }
        
        return Math.max(1, Math.min(100, h + boost + cleanPenalty + entertainerBonus));
    };
    
    PPT.game.getHappyLabel = function(h) {
        if (h <= 1) return 'Abandoned';
        if (h <= 30) return 'Uneasy';
        if (h <= 45) return 'Dull';
        if (h <= 60) return 'Okay';
        if (h <= 75) return 'Enjoyable';
        if (h <= 90) return 'Thriving';
        return 'Euphoric';
    };
    
    PPT.game.calcGuestGen = function() {
        const scenario = PPT.currentScenario;
        const eco = scenario.economy;
        const tm = scenario.timeMultipliers;
        const c = PPT.game.countBuildings();
        const dp = PPT.render.getDayPart();
        const dow = G.day % 7;
        
        let timeMult = tm[dp] || 0;
        if (dow === 5 || dow === 6) timeMult *= tm.weekendBonus;
        
        // Fair price: what guests think the park is worth
        var fairPrice = eco.fairPriceBase + eco.fairPriceScale * Math.sqrt(c.attrCost);
        G.fairPrice = fairPrice;
        
        // Price modifier (asymmetric elasticity)
        var priceDiff = fairPrice > 0 ? (fairPrice - G.entryFee) / fairPrice : 0;
        var base = 1 + priceDiff;
        var priceMod = base <= 0 ? 0 : Math.pow(base, priceDiff >= 0 ? 1.2 : 1.8);
        G.priceMod = priceMod;
        
        // Guest cap (soft cap from ride value)
        var maxGuests = c.attrCost / eco.maxGuestsDivisor;
        var crowdFactor = maxGuests > 0 ? Math.max(0, 1 - Math.pow(G.guests / maxGuests, 3)) : 0;
        G.crowdFactor = crowdFactor;
        
        // Variety bonus: ×1.15 if all 4 guest types are present
        var varietyBonus = 1.0;
        if (G.guestTypeCounts) {
            var allPresent = Object.keys(PPT.config.GUEST_TYPES).every(function(t) {
                return (G.guestTypeCounts[t] || 0) > 0;
            });
            if (allPresent) varietyBonus = 1.15;
        }
        
        return Math.log(1 + c.attrCost / eco.guestGenDivisor)
             * (G.happiness / 100) * timeMult * priceMod * crowdFactor * varietyBonus
             * (PPT.events ? PPT.events.getGuestGenModifier() : 1.0);
    };
    
    // ==================== PLACEMENT ====================
    
    PPT.game.canPlace = function(gx, gy, type) {
        const scenario = PPT.currentScenario;
        const d = scenario.buildings[type];
        if (!d) return false;
        
        const sz = d.size || 1;
        
        // Check bounds and existing buildings
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                const tx = gx + dx, ty = gy + dy;
                if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) return false;
                const c = G.grid[ty][tx];
                if (c !== null && !(c.natural && PPT.config.TREE_TYPES.includes(type))) return false;
            }
        }
        
        // Path must connect to existing path
        if (d.cat === 'path') {
            const adj = [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]];
            return adj.some(([ax, ay]) => ax >= 0 && ax < GRID_WIDTH && ay >= 0 && ay < GRID_HEIGHT && PPT.render.isPathAt(ax, ay));
        }
        
        // Decor can be placed anywhere
        if (d.cat === 'decor') return true;
        
        // Rides/coasters/food must be adjacent to path
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                const adj = [[gx + dx - 1, gy + dy], [gx + dx + sz, gy + dy], [gx + dx, gy + dy - 1], [gx + dx, gy + dy + sz]];
                for (const [ax, ay] of adj) {
                    if (ax >= 0 && ax < GRID_WIDTH && ay >= 0 && ay < GRID_HEIGHT && PPT.render.isPathAt(ax, ay)) return true;
                }
            }
        }
        
        return false;
    };
    
    PPT.game.place = function(gx, gy, type) {
        const scenario = PPT.currentScenario;
        const d = scenario.buildings[type];
        // Skip money check in debug mode
        if (!d || (!G.debugMode && G.money < d.cost) || !PPT.game.canPlace(gx, gy, type)) {
            PPT.audio.playSound('error');
            return false;
        }
        
        const sz = d.size || 1;
        const tpd = PPT.config.TICKS_PER_DAY;
        
        // Determine construction time
        var buildTicks = 0;
        if (d.cat === 'ride') buildTicks = Math.floor(tpd / 2);            // half day
        else if (d.cat === 'food') buildTicks = Math.floor(tpd / 4);     // quarter day
        else if (d.cat === 'coaster') buildTicks = tpd;                   // 1 day
        // paths and decor: 0 = instant
        
        var isBuilding = buildTicks > 0;
        
        // Place building on grid
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                if (dx === 0 && dy === 0) {
                    G.grid[gy][gx] = { type, sway: Math.random() * Math.PI * 2, building: isBuilding, buildTicks: buildTicks, buildTotal: buildTicks };
                } else {
                    G.grid[gy + dy][gx + dx] = { type, parent: { x: gx, y: gy } };
                }
            }
        }
        
        G.buildings.push({ type, x: gx, y: gy, building: isBuilding, buildTicks: buildTicks, buildTotal: buildTicks, builtTick: isBuilding ? null : G.tick, current_visitors: 0, sales_today: 0, revenue_today: 0 });
        
        // PERF: Invalidate grid-dependent caches (path tiles, building openings, pathSet)
        PPT.render.invalidateGrid();
        
        // Record entrance tile (the adjacent path tile guests use to enter)
        var newBldg = G.buildings[G.buildings.length - 1];
        var entrance = PPT.game._findFirstAdjacentPath(newBldg);
        if (entrance) {
            newBldg.entrance_x = entrance.x;
            newBldg.entrance_y = entrance.y;
        }
        if (!G.debugMode) { G.money -= d.cost; PPT.game.trackFinance('construction', -d.cost); }
        PPT.ui.updateMoney();
        PPT.game.spawnParticle(gx * TILE_SIZE + 16, gy * TILE_SIZE + 16, 'neg', G.debugMode ? 'FREE' : '-\u20ac' + d.cost);
        
        // Apply boost immediately only for instant builds (decor/paths)
        if (!isBuilding) {
            const boosts = scenario.boosts;
            if (d.cat === 'ride') G.boosts.push({ amt: boosts.ride.amount, ticks: boosts.ride.ticks });
            else if (d.cat === 'coaster') G.boosts.push({ amt: boosts.coaster.amount, ticks: boosts.coaster.ticks });
            else if (d.cat === 'food') G.boosts.push({ amt: boosts.food.amount, ticks: boosts.food.ticks });
        }
        
        PPT.audio.playSound('build');
        
        // Auto-save after building
        PPT.state.save();
        
        return true;
    };
    
    PPT.game.demolish = function(gx, gy) {
        const scenario = PPT.currentScenario;
        if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) return false;
        
        const c = G.grid[gy][gx];
        if (!c || c.perm) return false;
        
        let tx = gx, ty = gy;
        if (c.parent) { tx = c.parent.x; ty = c.parent.y; }
        
        const tc = G.grid[ty][tx];
        const d = scenario.buildings[tc.type];
        const sz = d?.size || 1;
        
        // Full refund if under construction, otherwise sell rate
        const isBuilding = tc.building;
        const refund = isBuilding
            ? (d?.cost || 0)
            : Math.floor((d?.cost || 0) * (scenario.economy.sellRefundRate || 0.6));
        
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                G.grid[ty + dy][tx + dx] = null;
            }
        }
        
        G.buildings = G.buildings.filter(b => !(b.x === tx && b.y === ty));
        
        // PERF: Invalidate grid-dependent caches (path tiles, building openings, pathSet)
        PPT.render.invalidateGrid();
        
        // Remove any breakdown entry for this building
        if (G.rideBreakdowns) {
            G.rideBreakdowns = G.rideBreakdowns.filter(function(bd) { return !(bd.x === tx && bd.y === ty); });
        }
        
        if (!G.debugMode && refund > 0) {
            G.money += refund;
            PPT.game.trackFinance('construction', refund);
        }
        
        PPT.ui.updateMoney();
        PPT.game.spawnParticle(gx * TILE_SIZE + 16, gy * TILE_SIZE + 16, 'coin', G.debugMode ? 'FREE' : '+\u20ac' + refund);
        PPT.audio.playSound('build');
        PPT.state.save();
        
        return true;
    };
    
    // ==================== SPAWNING ====================
    
    PPT.game.spawnParticle = function(x, y, type, text) {
        G.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 2,
            vy: -2 - Math.random() * 2,
            life: 1,
            type,
            text: text || ''
        });
    };
    
    PPT.game.spawnConfetti = function() {
        const C = PPT.config.C;
        for (let i = 0; i < 100; i++) {
            G.confetti.push({
                x: Math.random() * window.innerWidth,
                y: -20 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 3,
                color: [C.pink, C.dblue, C.yellow, C.green, C.purple, C.orange][Math.floor(Math.random() * 6)],
                rot: Math.random() * Math.PI * 2,
                rotSpd: (Math.random() - 0.5) * 0.3,
                life: 1
            });
        }
    };
    
    // Determine body type based on guest type rules
    PPT.game.pickBodyType = function(guestType) {
        var roll = Math.random();
        if (guestType === 'family') {
            // 35% boy, 35% girl, 15% man, 15% woman
            if (roll < 0.35) return 'boy';
            if (roll < 0.70) return 'girl';
            if (roll < 0.85) return 'man';
            return 'woman';
        }
        // thrillSeeker, vip, foodie: 50/50 man or woman
        return roll < 0.5 ? 'man' : 'woman';
    };
    
    // Create guest appearance properties
    PPT.game.makeGuestAppearance = function(guestType) {
        var bodyType = PPT.game.pickBodyType(guestType);
        var skin = PPT.config.SKIN_COLORS[Math.floor(Math.random() * PPT.config.SKIN_COLORS.length)];
        var hair = PPT.config.HAIR_COLORS[Math.floor(Math.random() * PPT.config.HAIR_COLORS.length)];
        var outfitIdx = Math.floor(Math.random() * PPT.config.OUTFIT_COMBOS.length);
        return { bodyType: bodyType, skin: skin, hair: hair, outfitIdx: outfitIdx };
    };
    
    PPT.game.spawnGuest = function() {
        var c = PPT.game.countBuildings();
        var TYPES = PPT.config.GUEST_TYPES;
        var NAMES = PPT.config.GUEST_NAMES;
        var BEH = PPT.config.BEHAVIOR;
        
        // Weighted type selection based on park composition
        var scores = {
            family: c.rides + 1,
            thrillSeeker: c.coasters + 1,
            foodie: c.food + 1,
            vip: c.decor + 1
        };
        var total = scores.family + scores.thrillSeeker + scores.foodie + scores.vip;
        var roll = Math.random() * total;
        var guestType = 'family';
        var acc = 0;
        var typeKeys = Object.keys(scores);
        for (var ti = 0; ti < typeKeys.length; ti++) {
            acc += scores[typeKeys[ti]];
            if (roll < acc) { guestType = typeKeys[ti]; break; }
        }
        
        var td = TYPES[guestType];
        var appear = PPT.game.makeGuestAppearance(guestType);
        
        // Determine movement mode
        var movementMode = Math.random() < BEH.visitorRatio ? 'visitor' : 'wanderer';
        
        // Generate wishlist for visitors
        var wishlist = [];
        if (movementMode === 'visitor') {
            wishlist = PPT.game.generateWishlist();
            // If no attractions exist, fall back to wanderer
            if (wishlist.length === 0) movementMode = 'wanderer';
        }
        
        // Randomized hunger/thirst starting values
        var hunger = BEH.hungerMin + Math.random() * (BEH.hungerMax - BEH.hungerMin);
        var thirst = BEH.thirstMin + Math.random() * (BEH.thirstMax - BEH.thirstMin);
        var hungerThreshold = BEH.hungerThreshMin + Math.random() * (BEH.hungerThreshMax - BEH.hungerThreshMin);
        var thirstThreshold = BEH.thirstThreshMin + Math.random() * (BEH.thirstThreshMax - BEH.thirstThreshMin);
        
        G.guestSprites.push({
            // Existing properties
            x: -140 - Math.random() * 40,
            y: 5 * TILE_SIZE + 10 + Math.random() * 12,
            tx: 1 * TILE_SIZE + 8 + Math.random() * 16,
            ty: 5 * TILE_SIZE + 8 + Math.random() * 16,
            color: td.color,
            bodyType: appear.bodyType,
            skin: appear.skin,
            hair: appear.hair,
            outfitIdx: appear.outfitIdx,
            wait: 0,
            entering: true,
            name: NAMES[Math.floor(Math.random() * NAMES.length)],
            type: guestType,
            spent: G.entryFee,
            
            // === NEW: Behavior system properties ===
            id: G.tick + '_' + Math.floor(Math.random() * 100000),
            movement_mode: movementMode,
            
            // Goals
            wishlist: wishlist,
            current_goal: wishlist.length > 0 ? wishlist[0] : null,
            status: wishlist.length > 0 ? 'walking_to_goal' : 'wandering',
            
            // Visited log
            visited: [],
            
            // Attraction state
            in_attraction: false,
            attraction_timer: 0,
            
            // Needs
            hunger: hunger,
            thirst: thirst,
            hunger_threshold: hungerThreshold,
            thirst_threshold: thirstThreshold,
            
            // Money
            money_spent: G.entryFee
        });
        
        G.guestTypeCounts[guestType] = (G.guestTypeCounts[guestType] || 0) + 1;
    };
    
    // ==================== UPDATES ====================
    
    PPT.game.updateGuests = function() {
        if (G.paused) return;
        var scenario = PPT.currentScenario;
        var BLDGS = scenario.buildings;
        var BEH = PPT.config.BEHAVIOR;
        var PRODUCTS = PPT.config.FOOD_PRODUCTS;
        
        // PERF: Use cached path set (only rebuilt when grid changes)
        var pathSet = getPathSet();
        
        G.guestSprites.forEach(function(g) {
            if (G.carriedGuest === g) return;
            
            // --- Entering from outside ---
            if (g.entering) {
                if (g.tx && Math.abs(g.x - g.tx) < 4 && Math.abs(g.y - g.ty) < 4) {
                    g.entering = false;
                    g.tx = null;
                    g.ty = null;
                }
                if (g.tx) {
                    var dx = g.tx - g.x, dy = g.ty - g.y, d = Math.sqrt(dx * dx + dy * dy);
                    if (d > 1) { g.x += dx / d * 1.6; g.y += dy / d * 1.6; }
                }
                return;
            }
            
            // === STEP 1: IN ATTRACTION ===
            if (g.in_attraction) {
                g.attraction_timer--;
                if (g.attraction_timer <= 0) {
                    g.in_attraction = false;
                    // Decrement current_visitors on the building
                    var ab = PPT.game.findBuildingAtCoord(g._attr_x, g._attr_y);
                    if (ab) ab.current_visitors = Math.max(0, (ab.current_visitors || 0) - 1);
                    g._attr_x = null; g._attr_y = null;
                    // Advance to next goal
                    if (g.wishlist && g.wishlist.length > 0) {
                        g.current_goal = g.wishlist[0];
                        g.status = 'walking_to_goal';
                    } else if (g.movement_mode === 'visitor') {
                        g.status = 'leaving';
                        g.current_goal = { x: 0, y: 5 }; // exit
                    } else {
                        g.current_goal = null;
                        g.status = 'wandering';
                    }
                    g._bfsPath = null;
                }
                return;
            }
            
            // === STEP 2: NEEDS CHECK (priority) ===
            // Hungry/thirsty guests divert to food stalls, but save their current goal to resume after.
            // PERF: Throttle expensive BFS food search to every FOOD_SEARCH_COOLDOWN frames per guest.
            if (g.status !== 'seeking_food') {
                var needFood = g.hunger != null && g.hunger > g.hunger_threshold;
                var needDrink = g.thirst != null && g.thirst > g.thirst_threshold;
                if (needFood || needDrink) {
                    if (!g._foodSearchCooldown || g._foodSearchCooldown <= 0) {
                        g._foodSearchCooldown = FOOD_SEARCH_COOLDOWN;
                        var needType = (needDrink && (!needFood || g.thirst > g.hunger)) ? 'drink' : 'food';
                        var gx = Math.floor(g.x / TILE_SIZE), gy = Math.floor(g.y / TILE_SIZE);
                        var stall = PPT.game.findNearestFoodStall(gx, gy, needType);
                        if (!stall && needType === 'food') stall = PPT.game.findNearestFoodStall(gx, gy, 'drink');
                        if (!stall && needType === 'drink') stall = PPT.game.findNearestFoodStall(gx, gy, 'food');
                        if (stall) {
                            // Save current goal so we can resume after eating
                            if (g.status === 'walking_to_goal' && g.current_goal) {
                                g._saved_goal = { x: g.current_goal.x, y: g.current_goal.y, type: g.current_goal.type };
                                g._saved_status = 'walking_to_goal';
                            }
                            g.status = 'seeking_food';
                            g.current_goal = { x: stall.x, y: stall.y, type: stall.type };
                            g._bfsPath = null;
                        }
                    } else {
                        g._foodSearchCooldown--;
                    }
                }
            }
            
            // === STEP 3: MOVEMENT ===
            if (g.wait > 0) { g.wait--; return; }
            
            var atTarget = g.tx == null || (Math.abs(g.x - g.tx) < 4 && Math.abs(g.y - g.ty) < 4);
            
            if (atTarget) {
                var cx = Math.floor(g.x / TILE_SIZE), cy = Math.floor(g.y / TILE_SIZE);
                
                // --- STEP 4: PASS-BY CHECK (on each new tile) ---
                guestPassByCheck(g, cx, cy, scenario, BLDGS, PRODUCTS);
                // If pass-by put us in attraction, stop here
                if (g.in_attraction) return;
                
                // Check if we arrived at our goal
                if (g.current_goal) {
                    var goalAdj = PPT.game.findAdjacentPath(g.current_goal);
                    var atGoal = (goalAdj && cx === goalAdj.x && cy === goalAdj.y) ||
                                 (cx === g.current_goal.x && cy === g.current_goal.y);
                    
                    if (atGoal) {
                        var goalBldg = PPT.game.findBuildingAtCoord(g.current_goal.x, g.current_goal.y);
                        
                        if (goalBldg) {
                            var d = BLDGS[goalBldg.type];
                            var cat = d ? d.cat : null;
                            
                            if (cat === 'food') {
                                // Buy food (guest stays visible)
                                PPT.game.purchaseFood(g, goalBldg);
                                registerVisit(g, goalBldg);
                                g.wait = 15 + Math.floor(Math.random() * 10);
                            } else if (cat === 'ride' || cat === 'coaster') {
                                // Enter attraction
                                var cap = PPT.game.getCapacity(goalBldg);
                                if ((goalBldg.current_visitors || 0) < cap) {
                                    enterAttraction(g, goalBldg);
                                }
                            }
                        }
                        
                        // Check if leaving (arrived at exit)
                        if (g.status === 'leaving' && cx <= 1 && cy === 5) {
                            // Remove guest
                            g._remove = true;
                            return;
                        }
                        
                        // Advance goal
                        g.current_goal = null;
                        g._bfsPath = null;
                        // Resume saved goal (from food detour) if available
                        if (g._saved_goal) {
                            g.current_goal = g._saved_goal;
                            g.status = g._saved_status || 'walking_to_goal';
                            g._saved_goal = null;
                            g._saved_status = null;
                        } else if (g.wishlist && g.wishlist.length > 0) {
                            g.current_goal = g.wishlist[0];
                            g.status = 'walking_to_goal';
                        } else if (g.movement_mode === 'visitor') {
                            g.status = 'leaving';
                            g.current_goal = { x: 0, y: 5 };
                        } else {
                            g.status = 'wandering';
                        }
                    }
                }
                
                // Determine next tile to walk to
                if (g.current_goal && g.status !== 'wandering') {
                    // BFS toward goal
                    if (!g._bfsPath || g._bfsPath.length === 0) {
                        var goalTile = PPT.game.findAdjacentPath(g.current_goal) || g.current_goal;
                        g._bfsPath = PPT.game.bfsPath(cx, cy, goalTile.x, goalTile.y);
                        if (g._bfsPath && g._bfsPath.length > 1) g._bfsPath.shift(); // remove current position
                    }
                    if (g._bfsPath && g._bfsPath.length > 0) {
                        var next = g._bfsPath.shift();
                        g.tx = next.x * TILE_SIZE + 8 + Math.random() * 16;
                        g.ty = next.y * TILE_SIZE + 8 + Math.random() * 12;
                    } else {
                        // Can't reach goal - wander instead
                        pickRandomAdjacentTile(g, cx, cy, pathSet);
                    }
                } else {
                    // Wandering: random adjacent path tile
                    pickRandomAdjacentTile(g, cx, cy, pathSet);
                    if (Math.random() < 0.08) g.wait = 20 + Math.floor(Math.random() * 40);
                }
            }
            
            // Walk toward target
            if (g.tx != null) {
                var dx2 = g.tx - g.x, dy2 = g.ty - g.y, d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (d2 > 1) { g.x += dx2 / d2 * 0.5; g.y += dy2 / d2 * 0.5; }
            }
        });
        
        // Remove guests that left the park
        var removed = G.guestSprites.filter(function(g) { return g._remove; });
        removed.forEach(function(g) {
            if (G.guestTypeCounts[g.type]) G.guestTypeCounts[g.type]--;
            G.guests = Math.max(0, G.guests - 1);
        });
        G.guestSprites = G.guestSprites.filter(function(g) { return !g._remove; });
    };
    
    // Helper: find a building in G.buildings at grid coord
    PPT.game.findBuildingAtCoord = function(bx, by) {
        for (var i = 0; i < G.buildings.length; i++) {
            var b = G.buildings[i];
            if (b.building) continue;
            var d = PPT.currentScenario.buildings[b.type];
            var sz = d ? (d.size || 1) : 1;
            if (bx >= b.x && bx < b.x + sz && by >= b.y && by < b.y + sz) return b;
        }
        return null;
    };
    
    // Helper: pick random adjacent path tile for wandering
    function pickRandomAdjacentTile(g, cx, cy, pathSet) {
        var dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        var opts = [];
        for (var i = 0; i < dirs.length; i++) {
            var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
            if (pathSet[nx + ',' + ny]) opts.push({ x: nx, y: ny });
        }
        if (opts.length > 0) {
            var t = opts[Math.floor(Math.random() * opts.length)];
            g.tx = t.x * TILE_SIZE + 8 + Math.random() * 16;
            g.ty = t.y * TILE_SIZE + 8 + Math.random() * 12;
        }
    }
    
    // Helper: register a visit
    function registerVisit(g, building) {
        var wasPlanned = false;
        if (g.wishlist) {
            for (var i = g.wishlist.length - 1; i >= 0; i--) {
                if (g.wishlist[i].x === building.x && g.wishlist[i].y === building.y) {
                    g.wishlist.splice(i, 1);
                    wasPlanned = true;
                    break;
                }
            }
        }
        var scenario = PPT.currentScenario;
        var d = scenario.buildings[building.type];
        if (!g.visited) g.visited = [];
        g.visited.push({
            id: building.x + ',' + building.y,
            name: d ? d.name : building.type,
            tick: G.tick,
            was_planned: wasPlanned
        });
    }
    
    // Helper: enter an attraction
    function enterAttraction(g, building) {
        registerVisit(g, building);
        g.in_attraction = true;
        g.attraction_timer = PPT.config.BEHAVIOR.attractionBaseTime +
            Math.floor(Math.random() * PPT.config.BEHAVIOR.attractionTimeVariance);
        g._attr_x = building.x;
        g._attr_y = building.y;
        building.current_visitors = (building.current_visitors || 0) + 1;
    }
    
    // Helper: pass-by check — spontaneous visit of adjacent buildings (only from entrance tile)
    function guestPassByCheck(g, cx, cy, scenario, BLDGS, PRODUCTS) {
        var dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        for (var i = 0; i < dirs.length; i++) {
            var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
            if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
            var cell = G.grid[ny] && G.grid[ny][nx];
            if (!cell) continue;
            
            // Find the building at this cell
            var bx = nx, by = ny;
            if (cell.parent) { bx = cell.parent.x; by = cell.parent.y; }
            var building = PPT.game.findBuildingAtCoord(bx, by);
            if (!building || building.building) continue;
            
            var d = BLDGS[building.type];
            if (!d) continue;
            var cat = d.cat;
            if (cat !== 'ride' && cat !== 'coaster' && cat !== 'food') continue;
            
            // Only interact from the entrance tile
            var entrance = PPT.game.findAdjacentPath(building);
            if (!entrance || cx !== entrance.x || cy !== entrance.y) continue;
            
            // Skip if already visited
            var visitKey = building.x + ',' + building.y;
            var alreadyVisited = false;
            if (g.visited) {
                for (var v = 0; v < g.visited.length; v++) {
                    if (g.visited[v].id === visitKey) { alreadyVisited = true; break; }
                }
            }
            if (alreadyVisited) continue;
            
            // Calculate entry chance
            var chance = PPT.game.getEntryChance(building);
            // Scale down for pass-by (spontaneous visits are rarer)
            chance *= 0.25;
            
            // Boost food stall chance if guest is hungry/thirsty
            if (cat === 'food') {
                var prod = PRODUCTS[building.type];
                var isFood = prod && prod.food_type === 'food';
                var isDrink = prod && prod.food_type === 'drink';
                var needFood = g.hunger != null && g.hunger > g.hunger_threshold;
                var needDrink = g.thirst != null && g.thirst > g.thirst_threshold;
                if ((isFood && needFood) || (isDrink && needDrink)) {
                    chance = Math.max(chance, 0.85); // very likely to stop when they need it
                } else if (needFood || needDrink) {
                    chance = Math.max(chance, 0.55); // still tempted by any stall
                }
            }
            
            if (Math.random() < chance) {
                if (cat === 'food') {
                    PPT.game.purchaseFood(g, building);
                    registerVisit(g, building);
                    g.wait = 10 + Math.floor(Math.random() * 8);
                } else {
                    var cap = PPT.game.getCapacity(building);
                    if ((building.current_visitors || 0) < cap) {
                        enterAttraction(g, building);
                    }
                }
                return; // one interaction per tile
            }
        }
    }
    
    PPT.game.updateBirds = function() {
        if (G.paused) return;
        G.birds.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            b.vy += (Math.random() - 0.5) * 0.02;
            b.vy = Math.max(-0.3, Math.min(0.3, b.vy));
            if (b.x > 660) b.x = -20;
            if (b.x < -20) b.x = 660;
            if (b.y < 10) b.vy = Math.abs(b.vy);
            if (b.y > 100) b.vy = -Math.abs(b.vy);
        });
    };
    
    PPT.game.updateLeaves = function() {
        if (G.paused) return;
        const C = PPT.config.C;
        if (Math.random() < 0.003 && G.leaves.length < 6) {
            G.leaves.push({
                x: Math.random() * 640,
                y: -10,
                vx: (Math.random() - 0.5) * 0.2,
                vy: 0.15 + Math.random() * 0.2,
                rot: Math.random() * Math.PI * 2,
                rotSpd: (Math.random() - 0.5) * 0.015,
                sway: Math.random() * Math.PI * 2,
                color: [C.tree3, C.tree4, C.orange, C.yellow, '#ffb7c5'][Math.floor(Math.random() * 5)],
                size: 3 + Math.random() * 3
            });
        }
        for (let i = G.leaves.length - 1; i >= 0; i--) {
            const l = G.leaves[i];
            l.x += l.vx + Math.sin(G.frame * 0.015 + l.sway) * 0.2;
            l.y += l.vy;
            l.rot += l.rotSpd;
            if (l.y > 394) G.leaves.splice(i, 1);
        }
    };
    
    PPT.game.updateSparkles = function() {
        if (G.paused) return;
        if (Math.random() < 0.008 && PPT.render.getDayPart() !== 'night' && G.sparkles.length < 5) {
            G.sparkles.push({
                x: 20 + Math.random() * 600,
                y: 20 + Math.random() * 344,
                life: 1,
                maxLife: 80 + Math.random() * 80,
                size: 2 + Math.random() * 2
            });
        }
        for (let i = G.sparkles.length - 1; i >= 0; i--) {
            const s = G.sparkles[i];
            s.life -= 1 / s.maxLife;
            if (s.life <= 0) G.sparkles.splice(i, 1);
        }
    };
    
    // ==================== GOALS ====================
    
    PPT.game.currentGoal = function() {
        var goals = PPT.currentScenario.goals;
        if (!goals) return null;
        for (var i = 0; i < goals.length; i++) {
            if (!G.goalsAchieved[i]) return { idx: i, goal: goals[i] };
        }
        return null;
    };
    
    // Check if a single condition is met
    PPT.game.checkCondition = function(cond, c) {
        var catKey = { ride: 'rides', coaster: 'coasters', food: 'food', decor: 'decor', path: 'paths' };
        switch (cond.type) {
            case 'buildings':      return (c[catKey[cond.cat]] || 0) >= cond.min;
            case 'guests':         return G.guests >= cond.min;
            case 'happiness':      return G.happiness >= cond.min;
            case 'entryFee':       return G.entryFee >= cond.min;
            case 'staff':          return (G.staff || []).filter(function(s) { return s.type === cond.staffType; }).length >= cond.min;
            case 'maxTiles':       return G.buildings.length <= cond.max;
            case 'buildingsExact': return cond.types.every(function(t) { return G.buildings.some(function(b) { return b.type === t; }); });
            case 'allTilesFilled':
                for (var y = 0; y < GRID_HEIGHT; y++)
                    for (var x = 0; x < GRID_WIDTH; x++)
                        if (G.grid[y][x] === null && !G.grid[y][x]?.natural) return false;
                return true;
            default: return false;
        }
    };
    
    PPT.game.checkGoals = function() {
        var goals = PPT.currentScenario.goals;
        if (!goals || goals.length === 0) return;
        var c = PPT.game.countBuildings();
        
        // Only check the first incomplete goal (sequential order)
        var cg = PPT.game.currentGoal();
        if (!cg) return;
        var i = cg.idx;
        
        var allMet = goals[i].conditions.every(function(cond) {
            return PPT.game.checkCondition(cond, c);
        });
        if (allMet) {
            G.goalsAchieved[i] = true;
            
            // Notify but don't give reward — player must claim manually
            PPT.ui.showNotif(goals[i].name + ' complete! Claim your reward in Goals.', 'achievement');
            PPT.audio.playSound('achievement');
            
            PPT.ui.updateGoals();
            PPT.ui.updateGoalsDot();
            PPT.ui.buildBuildItems();
            PPT.ui.buildStaffPanel();
            PPT.state.save();
        }
    };
    
    PPT.game.claimGoal = function(i) {
        var goals = PPT.currentScenario.goals;
        if (!goals || !goals[i]) return;
        if (!G.goalsAchieved[i] || G.goalsClaimed[i]) return;
        
        G.goalsClaimed[i] = true;
        
        // Give reward
        if (goals[i].reward) {
            G.money += goals[i].reward;
            PPT.game.trackFinance('rewards', goals[i].reward);
        }
        G.boosts.push({ amt: PPT.currentScenario.boosts.goal.amount, ticks: PPT.currentScenario.boosts.goal.ticks });
        
        PPT.game.spawnConfetti();
        for (var j = 0; j < 15; j++) {
            (function(jj) {
                setTimeout(function() { PPT.game.spawnParticle(Math.random() * 640, Math.random() * 192, 'coin'); }, jj * 50);
            })(j);
        }
        
        PPT.audio.playSound('achievement');
        PPT.ui.updateMoney();
        PPT.ui.updateGoals();
        PPT.ui.updateGoalsDot();
        PPT.ui.buildObjectivesPanel();
        PPT.state.save();
    };
    
    // ==================== TIPS ====================
    
    PPT.game.checkTips = function() {
        const scenario = PPT.currentScenario;
        const eco = scenario.economy;
        const c = PPT.game.countBuildings();
        const g = G.guests;
        const now = Date.now();
        const cd = 120000;
        
        if (g > 0 && c.food < Math.ceil(g / eco.foodPerGuests) && (!G.lastTip.food || now - G.lastTip.food > cd)) {
            PPT.ui.showNotif('Guests are hungry! Build more food stalls.', 'warning');
            G.lastTip.food = now;
        }
        if (g > 0 && (c.rides + c.coasters) < Math.ceil(g / eco.ridesPerGuests) && (!G.lastTip.attr || now - G.lastTip.attr > cd)) {
            PPT.ui.showNotif('Guests want more fun! Build more attractions.', 'warning');
            G.lastTip.attr = now;
        }
        if (g > 0 && c.paths < Math.ceil(g / eco.pathsPerGuests) && (!G.lastTip.paths || now - G.lastTip.paths > cd)) {
            PPT.ui.showNotif('Overcrowded! Build more paths.', 'warning');
            G.lastTip.paths = now;
        }
        
        // Pricing tips
        var priceMod = G.priceMod || 1;
        var crowdFactor = G.crowdFactor || 1;
        var fairPrice = G.fairPrice || 0;
        
        // Free park nudge
        if (G.entryFee === 0 && g > 0 && (!G.lastTip.freeEntry || now - G.lastTip.freeEntry > cd)) {
            PPT.ui.showNotif('Your park is free! Set an entry fee to earn money.', 'warning');
            G.lastTip.freeEntry = now;
        }
        // Severe overpricing
        if (priceMod < 0.3 && G.entryFee > 0 && (!G.lastTip.priceTooHigh || now - G.lastTip.priceTooHigh > cd)) {
            PPT.ui.showNotif('Entry fee way too high! Almost no one is coming.', 'negative');
            G.lastTip.priceTooHigh = now;
        }
        // Moderate overpricing
        else if (priceMod < 0.6 && G.entryFee > 0 && (!G.lastTip.priceHigh || now - G.lastTip.priceHigh > cd)) {
            PPT.ui.showNotif('Entry fee seems steep — guests are hesitant.', 'warning');
            G.lastTip.priceHigh = now;
        }
        // Underpricing
        if (priceMod > 1.3 && G.entryFee > 0 && G.entryFee < fairPrice * 0.5
            && (!G.lastTip.priceLow || now - G.lastTip.priceLow > cd)) {
            PPT.ui.showNotif('Your park is a bargain! You could charge more.', 'info');
            G.lastTip.priceLow = now;
        }
        // Capacity warning
        if (crowdFactor < 0.2 && g > 20 && (!G.lastTip.crowded || now - G.lastTip.crowded > cd)) {
            PPT.ui.showNotif('Park is packed! Build more rides to increase capacity.', 'warning');
            G.lastTip.crowded = now;
        }
        
        // Cleanliness warnings
        if (G.cleanliness < 30 && (!G.lastTip.dirty || now - G.lastTip.dirty > cd)) {
            PPT.ui.showNotif('The park is filthy! Hire more janitors.', 'negative');
            G.lastTip.dirty = now;
        } else if (G.cleanliness < 50 && (!G.lastTip.dirtyWarn || now - G.lastTip.dirtyWarn > cd)) {
            PPT.ui.showNotif('Litter is piling up. Consider hiring a janitor.', 'warning');
            G.lastTip.dirtyWarn = now;
        }
        
        // Entertainer suggestion (5 min cooldown)
        if (G.happiness < 40 && (G.staff || []).length > 0
            && !(G.staff || []).some(function(s) { return s.type === 'entertainer'; })
            && (!G.lastTip.needEntertainer || now - G.lastTip.needEntertainer > 300000)) {
            PPT.ui.showNotif('Happiness is low. Entertainers can cheer up your guests!', 'info');
            G.lastTip.needEntertainer = now;
        }
        
        // First guest of the day
        if (G.guests === 1 && G.guestSprites.length === 1 && !G.lastTip.firstGuest) {
            PPT.ui.showNotif(G.guestSprites[0].name + ' is your first visitor today!', 'info');
            G.lastTip.firstGuest = true;
        }
        
        // All 4 types present (one-time)
        if (!G.hints.varietyTip && G.guestTypeCounts) {
            var allPresent = Object.keys(PPT.config.GUEST_TYPES).every(function(t) { return G.guestTypeCounts[t] > 0; });
            if (allPresent) {
                PPT.ui.showNotif('Nice variety! A balanced park attracts all types.', 'info');
                G.hints.varietyTip = true;
            }
        }
        
        // Type dominance warnings (5 min cooldown)
        var typeTotal = G.guestTypeCounts ? Object.values(G.guestTypeCounts).reduce(function(a,b){return a+b;}, 0) : 0;
        if (typeTotal > 20) {
            if (G.guestTypeCounts.thrillSeeker / typeTotal > 0.6
                && (!G.lastTip.thrillDom || now - G.lastTip.thrillDom > 300000)) {
                PPT.ui.showNotif('Mostly thrill seekers \u2014 they barely buy food!', 'warning');
                G.lastTip.thrillDom = now;
            }
            if (G.guestTypeCounts.foodie / typeTotal > 0.6
                && (!G.lastTip.foodieDom || now - G.lastTip.foodieDom > 300000)) {
                PPT.ui.showNotif('Lots of foodies! Make sure you have enough food stalls.', 'info');
                G.lastTip.foodieDom = now;
            }
            if (G.guestTypeCounts.vip / typeTotal > 0.4
                && (!G.lastTip.vipDom || now - G.lastTip.vipDom > 300000)) {
                PPT.ui.showNotif('VIPs love your park! They spend big on food.', 'info');
                G.lastTip.vipDom = now;
            }
        }
        
        // Goal-specific hints
        var goals = PPT.currentScenario.goals;
        var cg = PPT.game.currentGoal();
        if (cg) {
            var goal = cg.goal;
            // Reset hint when current goal changes
            if (G.lastTip.goalIdx !== cg.idx) {
                G.lastTip.goalIdx = cg.idx;
                G.lastTip.goalHint = null;
            }
            if (!G.lastTip.goalHint) {
                if (goal.name === 'First Steps' && c.rides >= 1 && c.food === 0) {
                    PPT.ui.showNotif('Good start! Now build a food stall.', 'info');
                    G.lastTip.goalHint = now;
                }
                if (goal.name === 'Open for Business' && G.entryFee === 0 && c.rides >= 2) {
                    PPT.ui.showNotif('Try setting an entry fee \u2014 click the coin icon.', 'info');
                    G.lastTip.goalHint = now;
                }
                if (goal.name === 'Staffing Up' && !(G.staff || []).some(function(s) { return s.type === 'janitor'; })) {
                    PPT.ui.showNotif('Hire a janitor from the Staff panel to keep your park clean!', 'info');
                    G.lastTip.goalHint = now;
                }
                if (goal.name === 'Crowd Pleaser' && G.happiness < 50 && g > 30) {
                    PPT.ui.showNotif('Happiness is holding you back. Add more variety.', 'info');
                    G.lastTip.goalHint = now;
                }
                if (goal.name === 'Thrill Capital' && c.coasters < 2 && G.day >= 10) {
                    PPT.ui.showNotif('You need 2 coasters. Check the build menu!', 'info');
                    G.lastTip.goalHint = now;
                }
            }
        }
        // All goals done (one-time)
        if (goals && goals.length > 0 && !G.hints.allGoals && goals.every(function(_, i) { return G.goalsAchieved[i]; })) {
            PPT.ui.showNotif('All challenges complete! You\'re a theme park legend.', 'achievement');
            G.hints.allGoals = true;
        }
    };
    
    // ==================== STAFF ====================
    
    PPT.game.hireStaff = function(staffType) {
        var scenario = PPT.currentScenario;
        if (!scenario.staff) return false;
        var sd = scenario.staff[staffType];
        if (!sd) return false;
        
        // Check unlock
        if (sd.unlock) {
            var goals = scenario.goals;
            var unlocked = false;
            for (var i = 0; i < goals.length; i++) {
                if (goals[i].name === sd.unlock && G.goalsAchieved[i]) { unlocked = true; break; }
            }
            if (!unlocked) {
                PPT.ui.showNotif('Complete ' + sd.unlock + ' challenge to unlock!', 'warning');
                PPT.audio.playSound('error');
                return false;
            }
        }
        
        var currentCount = (G.staff || []).filter(function(s) { return s.type === staffType; }).length;
        if (currentCount >= sd.maxCount) {
            PPT.ui.showNotif('Can\'t hire more \u2014 you\'ve reached the ' + sd.name + ' limit.', 'warning');
            PPT.audio.playSound('error');
            return false;
        }
        
        if (!G.debugMode && G.money < sd.cost) {
            PPT.ui.showNotif('Not enough money!', 'negative');
            PPT.audio.playSound('error');
            return false;
        }
        
        G.staff.push({ type: staffType });
        if (!G.debugMode) { G.money -= sd.cost; PPT.game.trackFinance('construction', -sd.cost); }
        PPT.ui.updateMoney();
        PPT.game.spawnParticle(320, 192, 'neg', G.debugMode ? 'FREE' : '-\u20ac' + sd.cost);
        PPT.audio.playSound('build');
        
        // Spawn walking sprite
        PPT.game.spawnStaffSprite(staffType);
        
        // First staff hired hint
        if (!G.hints.firstStaff && G.staff.length === 1) {
            PPT.ui.showNotif('Welcome aboard! Your new ' + sd.name + ' is ready to work.', 'info');
            G.hints.firstStaff = true;
        }
        
        PPT.ui.buildStaffPanel();
        PPT.state.save();
        return true;
    };
    
    PPT.game.fireStaff = function(staffType) {
        var scenario = PPT.currentScenario;
        if (!scenario.staff) return false;
        var sd = scenario.staff[staffType];
        if (!sd) return false;
        
        var idx = -1;
        for (var i = 0; i < G.staff.length; i++) {
            if (G.staff[i].type === staffType) { idx = i; break; }
        }
        if (idx < 0) return false;
        
        G.staff.splice(idx, 1);
        var refund = Math.floor(sd.cost * 0.5);
        if (!G.debugMode && refund > 0) { G.money += refund; PPT.game.trackFinance('construction', refund); }
        PPT.ui.updateMoney();
        PPT.game.spawnParticle(320, 192, 'coin', G.debugMode ? 'FREE' : '+\u20ac' + refund);
        PPT.audio.playSound('build');
        
        // Remove one sprite of this type
        if (G.staffSprites) {
            for (var si = G.staffSprites.length - 1; si >= 0; si--) {
                if (G.staffSprites[si].type === staffType) { G.staffSprites.splice(si, 1); break; }
            }
        }
        
        PPT.ui.buildStaffPanel();
        PPT.state.save();
        return true;
    };
    
    PPT.game.spawnStaffSprite = function(staffType) {
        var scenario = PPT.currentScenario;
        var sd = scenario.staff ? scenario.staff[staffType] : null;
        if (!sd) return;
        if (!G.staffSprites) G.staffSprites = [];
        G.staffSprites.push({
            type: staffType,
            x: 2 * TILE_SIZE + Math.random() * 16,
            y: 5 * TILE_SIZE + 8 + Math.random() * 12,
            tx: null, ty: null,
            wait: 0,
            color: sd.color
        });
    };
    
    PPT.game.rebuildStaffSprites = function() {
        G.staffSprites = [];
        if (!G.staff) return;
        G.staff.forEach(function(s) {
            PPT.game.spawnStaffSprite(s.type);
        });
    };
    
    PPT.game.updateStaff = function() {
        if (G.paused || !G.staffSprites || G.staffSprites.length === 0) return;
        if (PPT.render.getDayPart() === 'night') return;
        
        var paths = [];
        for (var y = 0; y < GRID_HEIGHT; y++) {
            for (var x = 0; x < GRID_WIDTH; x++) {
                var t = G.grid[y][x] ? G.grid[y][x].type : null;
                if (PPT.config.PATH_TYPES.includes(t)) paths.push({ x: x, y: y });
            }
        }
        
        G.staffSprites.forEach(function(s) {
            if (s.wait > 0) { s.wait--; return; }
            
            if (!s.tx || (Math.abs(s.x - s.tx) < 4 && Math.abs(s.y - s.ty) < 4)) {
                var cx = Math.floor(s.x / TILE_SIZE), cy = Math.floor(s.y / TILE_SIZE);
                var adj = paths.filter(function(p) { return Math.abs(p.x - cx) + Math.abs(p.y - cy) <= 1; });
                if (adj.length > 0) {
                    var t = adj[Math.floor(Math.random() * adj.length)];
                    s.tx = t.x * TILE_SIZE + 8 + Math.random() * 16;
                    s.ty = t.y * TILE_SIZE + 8 + Math.random() * 16;
                }
                // Stop more often and longer than guests
                if (Math.random() < 0.25) s.wait = 50 + Math.floor(Math.random() * 100);
            }
            if (s.tx) {
                var dx = s.tx - s.x, dy = s.ty - s.y, d = Math.sqrt(dx * dx + dy * dy);
                if (d > 1) { s.x += dx / d * 0.45; s.y += dy / d * 0.45; }
            }
        });
    };
    
    PPT.game.processStaffDaily = function() {
        var scenario = PPT.currentScenario;
        if (!scenario.staff) return;
        
        var c = PPT.game.countBuildings();
        var janitorCount = (G.staff || []).filter(function(s) { return s.type === 'janitor'; }).length;
        var mechanicCount = (G.staff || []).filter(function(s) { return s.type === 'mechanic'; }).length;
        
        // Cleanliness: decrease based on paths, offset by janitors
        var janitorCoverage = janitorCount * 5;
        var decrease = 2 * c.paths / Math.max(janitorCoverage, 1);
        var recovery = janitorCount * 5;
        G.cleanliness = Math.max(0, Math.min(100, G.cleanliness - decrease + recovery));
        
        // Ride breakdowns: uncovered rides have 5% chance, mechanics reduce chance
        var ridesAndCoasters = G.buildings.filter(function(b) {
            if (b.building) return false;
            var d = scenario.buildings[b.type];
            return d && (d.cat === 'ride' || d.cat === 'coaster');
        });
        
        var rideCount = ridesAndCoasters.length;
        // Each mechanic covers ~3 rides worth of protection
        var coverageRatio = rideCount > 0 ? Math.min(1, (mechanicCount * 3) / rideCount) : 1;
        
        // Skip breakdowns if safety inspection effect active
        var noBreak = PPT.events ? PPT.events.isNoBreakdown() : false;
        
        ridesAndCoasters.forEach(function(b) {
            if (noBreak) return;
            if ((G.rideBreakdowns || []).some(function(bd) { return bd.x === b.x && bd.y === b.y; })) return;
            
            // Breakdown chance: 5% base, reduced by mechanic coverage
            var chance = 0.05 * (1 - coverageRatio * 0.9);
            if (Math.random() < chance) {
                if (!G.rideBreakdowns) G.rideBreakdowns = [];
                G.rideBreakdowns.push({ x: b.x, y: b.y, repairTicks: 0 });
                var d = scenario.buildings[b.type];
                PPT.ui.showNotif((d ? d.name : 'A ride') + ' broke down! Mechanics can fix it.', 'negative');
                PPT.audio.playSound('error');
            }
        });
        
        // Mechanic repairs: each mechanic repairs one breakdown per day
        if (G.rideBreakdowns && G.rideBreakdowns.length > 0 && mechanicCount > 0) {
            var repairsLeft = mechanicCount;
            for (var ri = G.rideBreakdowns.length - 1; ri >= 0 && repairsLeft > 0; ri--) {
                var bd = G.rideBreakdowns[ri];
                bd.repairTicks = (bd.repairTicks || 0) + 1;
                if (bd.repairTicks >= 1) {
                    var bldg = G.buildings.find(function(b) { return b.x === bd.x && b.y === bd.y; });
                    var d = bldg ? scenario.buildings[bldg.type] : null;
                    G.rideBreakdowns.splice(ri, 1);
                    PPT.ui.showNotif((d ? d.name : 'A ride') + ' has been repaired.', 'info');
                    repairsLeft--;
                }
            }
        }
        
        // No mechanic hint
        if (G.rideBreakdowns && G.rideBreakdowns.length > 0
            && !(G.staff || []).some(function(s) { return s.type === 'mechanic'; })
            && !G.hints.needMechanic) {
            PPT.ui.showNotif('Rides are breaking! Hire a mechanic to keep them running.', 'warning');
            G.hints.needMechanic = true;
        }
    };
    
    // ==================== CONSTRUCTION ====================
    
    PPT.game.processConstruction = function() {
        if (G.paused) return;
        var scenario = PPT.currentScenario;
        var completed = false;
        
        G.buildings.forEach(function(b) {
            if (!b.building) return;
            b.buildTicks--;
            // Sync grid cell
            var cell = G.grid[b.y] && G.grid[b.y][b.x];
            if (cell) cell.buildTicks = b.buildTicks;
            
            if (b.buildTicks <= 0) {
                b.building = false;
                b.builtTick = G.tick;
                b.current_visitors = 0;
                delete b.buildTicks;
                delete b.buildTotal;
                if (cell) {
                    cell.building = false;
                    delete cell.buildTicks;
                    delete cell.buildTotal;
                }
                
                var d = scenario.buildings[b.type];
                if (d) {
                    // Apply boost on completion
                    var boosts = scenario.boosts;
                    if (d.cat === 'ride') G.boosts.push({ amt: boosts.ride.amount, ticks: boosts.ride.ticks });
                    else if (d.cat === 'coaster') G.boosts.push({ amt: boosts.coaster.amount, ticks: boosts.coaster.ticks });
                    else if (d.cat === 'food') G.boosts.push({ amt: boosts.food.amount, ticks: boosts.food.ticks });
                    
                    PPT.ui.showNotif(d.name + ' is ready!', 'achievement');
                    PPT.audio.playSound('achievement');
                    PPT.game.spawnParticle(b.x * TILE_SIZE + 16, b.y * TILE_SIZE + 16, 'coin', 'OPEN');
                }
                completed = true;
            }
        });
        
        if (completed) {
            PPT.render.invalidateGrid();
            PPT.ui.updateGoals();
            PPT.ui.buildBuildItems();
        }
    };
    
    // ==================== BEHAVIOR SYSTEM ====================
    
    /**
     * Calculate popularity for a building.
     * popularity = base_value_from_cost × freshness_multiplier
     */
    PPT.game.getPopularity = function(building) {
        var scenario = PPT.currentScenario;
        var d = scenario.buildings[building.type];
        if (!d) return 0;
        if (building.building) return 0; // under construction
        
        var basePop = d.cost / 1000;
        var freshMult = 0.8; // default for old buildings
        
        if (building.builtTick != null) {
            var age = G.tick - building.builtTick;
            var table = PPT.config.FRESHNESS_TABLE;
            for (var i = 0; i < table.length; i++) {
                if (age < table[i].maxTicks) {
                    freshMult = table[i].mult;
                    break;
                }
            }
        }
        
        return basePop * freshMult;
    };
    
    /**
     * Get capacity for a building (how many guests can be inside at once).
     */
    PPT.game.getCapacity = function(building) {
        var scenario = PPT.currentScenario;
        var d = scenario.buildings[building.type];
        if (!d) return 1;
        return PPT.config.getCapacity(building.type, d.cost);
    };
    
    /**
     * Calculate the chance a guest enters an attraction.
     * chance = popularity × (1 - crowding_penalty)
     * Returns 0 if at capacity.
     */
    PPT.game.getEntryChance = function(building) {
        var cap = PPT.game.getCapacity(building);
        var visitors = building.current_visitors || 0;
        if (visitors >= cap) return 0;
        
        var pop = PPT.game.getPopularity(building);
        var occupancy = visitors / cap;
        return pop * (1 - occupancy);
    };
    
    /**
     * BFS pathfinding over the path network.
     * Returns array of {x,y} grid positions from start to end, or null if unreachable.
     */
    PPT.game.bfsPath = function(startX, startY, endX, endY) {
        if (startX === endX && startY === endY) return [{ x: startX, y: startY }];
        
        var visited = {};
        var queue = [{ x: startX, y: startY, path: [{ x: startX, y: startY }] }];
        visited[startX + ',' + startY] = true;
        
        var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        
        while (queue.length > 0) {
            var cur = queue.shift();
            
            for (var i = 0; i < dirs.length; i++) {
                var nx = cur.x + dirs[i][0];
                var ny = cur.y + dirs[i][1];
                var key = nx + ',' + ny;
                
                if (visited[key]) continue;
                if (!PPT.render.isPathAt(nx, ny)) continue;
                
                visited[key] = true;
                var newPath = cur.path.concat({ x: nx, y: ny });
                
                if (nx === endX && ny === endY) return newPath;
                queue.push({ x: nx, y: ny, path: newPath });
            }
        }
        
        return null; // unreachable
    };
    
    /**
     * Find the nearest path tile adjacent to a building.
     * Returns {x, y} grid position or null.
     */
    // Internal: find first adjacent path tile (used at placement time)
    // Priority: below > right > left > above (matches computeBuildingOpenings in render.js)
    PPT.game._findFirstAdjacentPath = function(building) {
        var scenario = PPT.currentScenario;
        var d = scenario.buildings[building.type];
        var sz = d ? (d.size || 1) : 1;
        var bx = building.x, by = building.y;
        
        // Priority 1: Below (front-facing)
        for (var dx = 0; dx < sz; dx++) {
            if (PPT.render.isPathAt(bx + dx, by + sz)) return { x: bx + dx, y: by + sz };
        }
        // Priority 2: Right
        for (var dy = sz - 1; dy >= 0; dy--) {
            if (PPT.render.isPathAt(bx + sz, by + dy)) return { x: bx + sz, y: by + dy };
        }
        // Priority 3: Left
        for (var dy2 = sz - 1; dy2 >= 0; dy2--) {
            if (PPT.render.isPathAt(bx - 1, by + dy2)) return { x: bx - 1, y: by + dy2 };
        }
        // Priority 4: Above (back)
        for (var dx2 = 0; dx2 < sz; dx2++) {
            if (PPT.render.isPathAt(bx + dx2, by - 1)) return { x: bx + dx2, y: by - 1 };
        }
        return null;
    };
    
    // Return the building's entrance tile (stored at placement, or computed for legacy saves)
    PPT.game.findAdjacentPath = function(buildingOrGoal) {
        // Look up the actual building object (goal objects are {x,y,type} copies)
        var building = PPT.game.findBuildingAtCoord(buildingOrGoal.x, buildingOrGoal.y) || buildingOrGoal;
        if (building.entrance_x != null && building.entrance_y != null) {
            // Verify the entrance tile is still a valid path (in case paths were demolished)
            if (PPT.render.isPathAt(building.entrance_x, building.entrance_y)) {
                return { x: building.entrance_x, y: building.entrance_y };
            }
            // Invalid — recompute
            building.entrance_x = null;
            building.entrance_y = null;
        }
        // Compute and store
        var entrance = PPT.game._findFirstAdjacentPath(building);
        if (entrance) {
            building.entrance_x = entrance.x;
            building.entrance_y = entrance.y;
        }
        return entrance;
    };
    
    // Recompute all building entrances (call after load to apply current priority)
    PPT.game.recomputeEntrances = function() {
        if (!G.buildings) return;
        for (var i = 0; i < G.buildings.length; i++) {
            var b = G.buildings[i];
            b.entrance_x = null;
            b.entrance_y = null;
            PPT.game.findAdjacentPath(b);
        }
    };
    
    /**
     * Find the nearest food stall (by BFS) that resolves a given need.
     * need = "food" or "drink"
     * Returns the building object or null.
     */
    PPT.game.findNearestFoodStall = function(guestGridX, guestGridY, need) {
        var scenario = PPT.currentScenario;
        var PRODUCTS = PPT.config.FOOD_PRODUCTS;
        
        // Collect candidate stalls
        var stalls = [];
        G.buildings.forEach(function(b) {
            if (b.building) return;
            var d = scenario.buildings[b.type];
            if (!d || d.cat !== 'food') return;
            var prod = PRODUCTS[b.type];
            if (!prod) return;
            if (need && prod.food_type !== need) return;
            
            var adjPath = PPT.game.findAdjacentPath(b);
            if (!adjPath) return;
            stalls.push({ building: b, pathTile: adjPath });
        });
        
        // Find nearest by BFS distance
        var bestStall = null;
        var bestDist = Infinity;
        
        for (var i = 0; i < stalls.length; i++) {
            var path = PPT.game.bfsPath(guestGridX, guestGridY, stalls[i].pathTile.x, stalls[i].pathTile.y);
            if (path && path.length < bestDist) {
                bestDist = path.length;
                bestStall = stalls[i].building;
            }
        }
        
        return bestStall;
    };
    
    /**
     * Generate a wishlist for a visitor guest.
     * Picks 2-4 attractions weighted by popularity.
     */
    PPT.game.generateWishlist = function() {
        var scenario = PPT.currentScenario;
        var BEH = PPT.config.BEHAVIOR;
        var count = BEH.wishlistMin + Math.floor(Math.random() * (BEH.wishlistMax - BEH.wishlistMin + 1));
        
        // Collect all operational attractions (rides + coasters + food)
        var candidates = [];
        G.buildings.forEach(function(b) {
            if (b.building) return;
            var d = scenario.buildings[b.type];
            if (!d) return;
            if (d.cat === 'ride' || d.cat === 'coaster' || d.cat === 'food') {
                var pop = PPT.game.getPopularity(b);
                if (pop > 0) candidates.push({ building: b, pop: pop });
            }
        });
        
        if (candidates.length === 0) return [];
        
        // Weighted random selection without replacement
        var wishlist = [];
        var remaining = candidates.slice();
        
        for (var i = 0; i < count && remaining.length > 0; i++) {
            var totalPop = 0;
            for (var j = 0; j < remaining.length; j++) totalPop += remaining[j].pop;
            
            var roll = Math.random() * totalPop;
            var acc = 0;
            for (var k = 0; k < remaining.length; k++) {
                acc += remaining[k].pop;
                if (roll < acc) {
                    wishlist.push({ x: remaining[k].building.x, y: remaining[k].building.y, type: remaining[k].building.type });
                    remaining.splice(k, 1);
                    break;
                }
            }
        }
        
        return wishlist;
    };
    
    /**
     * Process a food stall purchase for a guest.
     */
    PPT.game.purchaseFood = function(guest, stallBuilding) {
        var PRODUCTS = PPT.config.FOOD_PRODUCTS;
        var prod = PRODUCTS[stallBuilding.type];
        if (!prod) return;
        
        var price = prod.product_price;
        
        // Resolve the need
        if (prod.food_type === 'food') guest.hunger = 0;
        if (prod.food_type === 'drink') guest.thirst = 0;
        
        // Track spending
        guest.money_spent += price;
        stallBuilding.sales_today = (stallBuilding.sales_today || 0) + 1;
        stallBuilding.revenue_today = (stallBuilding.revenue_today || 0) + price;
        
        // Add to park revenue
        G.money += price;
        PPT.game.trackFinance('foodRevenue', price);
    };
    
    /**
     * Reset daily food stall tracking (called at night transition).
     */
    PPT.game.resetDailyStallStats = function() {
        G.buildings.forEach(function(b) {
            b.sales_today = 0;
            b.revenue_today = 0;
        });
    };
    
    // ==================== GUEST INTERACTION ====================
    
    PPT.game.inspectGuestAt = function(canvasX, canvasY) {
        if (G.selected || G.demolishMode || G.carriedGuest) return null;
        var best = null, bestDist = 12;
        G.guestSprites.forEach(function(g) {
            if (g.entering && g.x < 0) return;
            var dx = (g.x + 4) - canvasX, dy = (g.y + 3) - canvasY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) { bestDist = dist; best = g; }
        });
        return best;
    };
    
    PPT.game.pickUpGuest = function() {
        if (!G.inspectedGuest) return;
        G.carriedGuest = G.inspectedGuest;
        G.inspectedGuest = null;
        PPT.ui.hideGuestCard();
        // Set cursor
        var parkCanvas = document.getElementById('park-canvas');
        if (parkCanvas) parkCanvas.style.cursor = 'grabbing';
    };
    
    PPT.game.dropGuest = function(canvasX, canvasY) {
        if (!G.carriedGuest) return;
        var cg = G.carriedGuest;
        var parkCanvas = document.getElementById('park-canvas');
        if (parkCanvas) parkCanvas.style.cursor = '';
        
        // Check if drop position is within canvas bounds
        if (canvasX < 0 || canvasX > 640 || canvasY < 0 || canvasY > 384) {
            // Off-canvas: remove guest
            var idx = G.guestSprites.indexOf(cg);
            if (idx >= 0) G.guestSprites.splice(idx, 1);
            if (G.guestTypeCounts[cg.type]) G.guestTypeCounts[cg.type]--;
            G.guests = Math.max(0, G.guests - 1);
            PPT.game.spawnParticle(Math.min(Math.max(canvasX, 20), 620), Math.min(Math.max(canvasY, 20), 370), 'neg', 'Bye, ' + (cg.name || 'Guest') + '!');
            G.carriedGuest = null;
            return;
        }
        
        // Check if landing on a path tile
        var gx = Math.floor(canvasX / TILE_SIZE), gy = Math.floor(canvasY / TILE_SIZE);
        if (PPT.render.isPathAt(gx, gy)) {
            cg.x = canvasX - 4;
            cg.y = canvasY - 5;
            cg.tx = null;
            cg.ty = null;
            cg.wait = 30;
            G.carriedGuest = null;
        } else {
            // Bounce back — find nearest path
            var paths = [];
            for (var y = 0; y < GRID_HEIGHT; y++) {
                for (var x = 0; x < GRID_WIDTH; x++) {
                    if (PPT.render.isPathAt(x, y)) paths.push({ x: x, y: y });
                }
            }
            if (paths.length > 0) {
                var best = paths[0], bestD = 999;
                paths.forEach(function(p) {
                    var d = Math.abs(p.x - gx) + Math.abs(p.y - gy);
                    if (d < bestD) { bestD = d; best = p; }
                });
                cg.x = best.x * TILE_SIZE + 8 + Math.random() * 16;
                cg.y = best.y * TILE_SIZE + 8 + Math.random() * 12;
                cg.tx = null; cg.ty = null; cg.wait = 30;
            }
            G.carriedGuest = null;
        }
    };
    
    // ==================== GAME TICK ====================
    
    PPT.game.tick = function() {
        if (G.paused) return;
        
        const scenario = PPT.currentScenario;
        const eco = scenario.economy;
        const tpd = PPT.config.TICKS_PER_DAY;
        
        G.tick++;
        const dp = PPT.render.getDayPart();
        const prevDp = PPT.config.getDayPeriod(G.tick - 1);
        
        // Day period transition - deduct 1/4 of daily running costs
        if (dp !== prevDp) {
            const c = PPT.game.countBuildings();
            var costsMod = PPT.events ? PPT.events.getCostsModifier() : 1.0;
            const quarterRun = Math.ceil(c.run * costsMod / 4);
            
            if (quarterRun > 0 && !G.debugMode) {
                G.money -= quarterRun;
                PPT.game.trackFinance('runningCosts', -quarterRun);
                PPT.game.spawnParticle(320, 192, 'neg', '-€' + quarterRun);
                PPT.ui.updateMoney();
            }
            
            // Night transition - park closes, reset guests, log history
            if (dp === 'night' && prevDp === 'evening') {
                G.history.push({ day: G.day, money: G.money, guests: G.guests, happiness: G.happiness });
                if (G.history.length > 30) G.history.shift();
                
                // Push today's finances into history
                if (G.todayFinances) {
                    var tf = G.todayFinances;
                    tf.day = G.day;
                    tf.total = (tf.entryFees || 0) + (tf.foodRevenue || 0) + (tf.runningCosts || 0) + (tf.staffSalaries || 0) + (tf.construction || 0) + (tf.events || 0) + (tf.rewards || 0);
                    if (!G.financeHistory) G.financeHistory = [];
                    G.financeHistory.push(tf);
                    if (G.financeHistory.length > 7) G.financeHistory.shift();
                    G.todayFinances = { entryFees: 0, foodRevenue: 0, runningCosts: 0, staffSalaries: 0, construction: 0, events: 0, rewards: 0 };
                }
                
                G.guestSprites = [];
                G.guests = 0;
                G.guestTypeCounts = { thrillSeeker: 0, foodie: 0, family: 0, vip: 0 };
                G.inspectedGuest = null;
                G.carriedGuest = null;
                G.lastTip.firstGuest = false;
                G.rain = [];
                PPT.ui.hideGuestCard();
                PPT.ui.hideStallCard();
                
                // Reset food stall daily stats and attraction visitors
                PPT.game.resetDailyStallStats();
                G.buildings.forEach(function(b) { b.current_visitors = 0; });
                
                PPT.ui.showNotif(G.debugMode ? 'Night. Park closed. (Debug: no running costs)' : 'Night. Park closed.', 'info');
            }
            
            // Morning transition - deduct staff salaries
            if (dp === 'morning' && prevDp === 'night' && scenario.staff && G.staff && G.staff.length > 0 && !G.debugMode) {
                var totalSalary = 0;
                G.staff.forEach(function(s) {
                    var sd = scenario.staff[s.type];
                    if (sd) totalSalary += sd.salary;
                });
                if (totalSalary > 0) {
                    G.money -= totalSalary;
                    PPT.game.trackFinance('staffSalaries', -totalSalary);
                    PPT.game.spawnParticle(320, 192, 'neg', '-\u20ac' + totalSalary);
                    PPT.ui.showNotif('Staff salaries: \u2212\u20ac' + totalSalary, 'info');
                    PPT.ui.updateMoney();
                }
            }
            
            // Morning - check for random events
            if (dp === 'morning' && prevDp === 'night' && PPT.events) {
                PPT.events.check();
            }
        }
        
        // Daytime - generate guests and income
        if (dp !== 'night') {
            const gen = PPT.game.calcGuestGen();
            G.guestAcc += gen;
            const whole = Math.floor(G.guestAcc);
            if (whole > 0) {
                G.guestAcc -= whole;
                var feeMod = PPT.events ? PPT.events.getEntryFeeModifier() : 1.0;
                var tickEntryFees = 0;
                for (let i = 0; i < whole; i++) {
                    G.guests++;
                    var fee = Math.round(G.entryFee * feeMod);
                    G.money += fee;
                    tickEntryFees += fee;
                    PPT.game.spawnGuest();
                }
                PPT.game.trackFinance('entryFees', tickEntryFees);
                PPT.ui.updateMoney();
            }
        }
        
        // Update guest hunger & thirst (per tick, NOT per frame)
        if (dp !== 'night') {
            var BEH = PPT.config.BEHAVIOR;
            G.guestSprites.forEach(function(g) {
                if (g.entering || g.in_attraction) return;
                if (g.hunger != null) {
                    g.hunger += BEH.hungerRateMin + Math.random() * (BEH.hungerRateMax - BEH.hungerRateMin);
                    if (g.hunger > 100) g.hunger = 100;
                }
                if (g.thirst != null) {
                    g.thirst += BEH.thirstRateMin + Math.random() * (BEH.thirstRateMax - BEH.thirstRateMin);
                    if (g.thirst > 100) g.thirst = 100;
                }
            });
        }
        
        // Update happiness
        G.happiness = PPT.game.calcHappiness();
        
        // Process boosts
        for (let i = G.boosts.length - 1; i >= 0; i--) {
            G.boosts[i].ticks--;
            if (G.boosts[i].ticks <= 0) G.boosts.splice(i, 1);
        }
        
        // Tick active event effects
        if (PPT.events) PPT.events.tickEffects();
        
        // Process construction timers
        PPT.game.processConstruction();
        
        // Check tips and goals
        if (G.tick % 6 === 0) PPT.game.checkTips();
        PPT.game.checkGoals();
        
        // Day progression
        if (G.tick % tpd === 0) {
            G.day++;
            
            // Staff daily processing (at start of each day)
            PPT.game.processStaffDaily();
            
            if (G.day > 365) { G.day = 1; G.year++; }
            
            // Auto-save at end of each day
            PPT.state.save();
        }
        
        // Update debug panel if open
        if (G.tick % 5 === 0 && document.getElementById('debug-panel')?.classList.contains('active')) {
            PPT.debug.updatePanel();
        }
        
        PPT.ui.updateDisplay();
    };
    
})();
