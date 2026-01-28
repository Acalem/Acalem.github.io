/**
 * Pixel Park Tycoon - Game Logic
 * Core game mechanics, economy, and building placement
 */

(function() {
    'use strict';
    
    const TILE_SIZE = PPT.config.TILE_SIZE;
    const GRID_WIDTH = PPT.config.GRID_WIDTH;
    const GRID_HEIGHT = PPT.config.GRID_HEIGHT;
    const C = PPT.config.C;
    
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
            G.grid[5][i] = { type: 'tiles' };
        }
        
        // Initialize buildings list
        G.buildings = [{ type: 'entrance', x: 0, y: 5 }];
        for (let i = 1; i <= wg.startPathLength; i++) {
            G.buildings.push({ type: 'tiles', x: i, y: 5 });
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
        
        G.buildings.forEach(b => {
            const d = scenario.buildings[b.type];
            if (!d) return;
            if (d.cat === 'ride') { rides++; attrCost += d.cost; }
            else if (d.cat === 'coaster') { coasters++; attrCost += d.cost; }
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
        
        // Staleness debuff - progressive penalty for days without building
        let stalenessDebuff = 0;
        if (G.daysSinceLastBuild >= 5) {
            stalenessDebuff = -50;
        } else if (G.daysSinceLastBuild >= 4) {
            stalenessDebuff = -40;
        } else if (G.daysSinceLastBuild >= 3) {
            stalenessDebuff = -30;
        } else if (G.daysSinceLastBuild >= 2) {
            stalenessDebuff = -20;
        }
        
        return Math.max(1, Math.min(100, h + boost + stalenessDebuff));
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
        
        return Math.log(1 + c.attrCost / eco.guestGenDivisor) * (G.happiness / 100) * timeMult;
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
        
        // Place building on grid
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                if (dx === 0 && dy === 0) {
                    G.grid[gy][gx] = { type, sway: Math.random() * Math.PI * 2 };
                } else {
                    G.grid[gy + dy][gx + dx] = { type, parent: { x: gx, y: gy } };
                }
            }
        }
        
        G.buildings.push({ type, x: gx, y: gy });
        if (!G.debugMode) G.money -= d.cost;
        PPT.ui.updateMoney();
        PPT.game.spawnParticle(gx * TILE_SIZE + 16, gy * TILE_SIZE + 16, 'neg', G.debugMode ? 'FREE' : '-€' + d.cost);
        
        // Reset staleness - player is building again
        G.daysSinceLastBuild = 0;
        G.staleNotified = false;
        
        // Apply boost
        const boosts = scenario.boosts;
        if (d.cat === 'ride') G.boosts.push({ amt: boosts.ride.amount, ticks: boosts.ride.ticks });
        else if (d.cat === 'coaster') G.boosts.push({ amt: boosts.coaster.amount, ticks: boosts.coaster.ticks });
        else if (d.cat === 'food') G.boosts.push({ amt: boosts.food.amount, ticks: boosts.food.ticks });
        
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
        
        // Calculate sell refund (60% of build cost)
        const refund = Math.floor((d?.cost || 0) * (scenario.economy.sellRefundRate || 0.6));
        
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                G.grid[ty + dy][tx + dx] = null;
            }
        }
        
        G.buildings = G.buildings.filter(b => !(b.x === tx && b.y === ty));
        
        // Add refund to money (instead of subtracting demolish cost)
        if (!G.debugMode && refund > 0) {
            G.money += refund;
        }
        
        PPT.ui.updateMoney();
        PPT.game.spawnParticle(gx * TILE_SIZE + 16, gy * TILE_SIZE + 16, 'coin', G.debugMode ? 'FREE' : '+€' + refund);
        PPT.audio.playSound('build');
        
        // Auto-save after selling
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
    
    PPT.game.spawnGuest = function() {
        G.guestSprites.push({
            x: 12,
            y: 5 * TILE_SIZE + 12,
            tx: null,
            ty: null,
            color: PPT.config.GUEST_COLORS[Math.floor(Math.random() * PPT.config.GUEST_COLORS.length)],
            hair: PPT.config.HAIR_COLORS[Math.floor(Math.random() * PPT.config.HAIR_COLORS.length)],
            wait: 0
        });
    };
    
    // ==================== UPDATES ====================
    
    PPT.game.updateGuests = function() {
        if (G.paused) return;
        const paths = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const t = G.grid[y][x]?.type;
                if (PPT.config.PATH_TYPES.includes(t)) paths.push({ x, y });
            }
        }
        
        G.guestSprites.forEach(g => {
            if (g.wait > 0) { g.wait--; return; }
            if (!g.tx || (Math.abs(g.x - g.tx) < 4 && Math.abs(g.y - g.ty) < 4)) {
                const cx = Math.floor(g.x / TILE_SIZE), cy = Math.floor(g.y / TILE_SIZE);
                const adj = paths.filter(p => Math.abs(p.x - cx) + Math.abs(p.y - cy) <= 1);
                if (adj.length > 0) {
                    const t = adj[Math.floor(Math.random() * adj.length)];
                    g.tx = t.x * TILE_SIZE + 8 + Math.random() * 16;
                    g.ty = t.y * TILE_SIZE + 8 + Math.random() * 16;
                }
                if (Math.random() < 0.1) g.wait = 30 + Math.floor(Math.random() * 60);
            }
            if (g.tx) {
                const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.sqrt(dx * dx + dy * dy);
                if (d > 1) { g.x += dx / d * 0.8; g.y += dy / d * 0.8; }
            }
        });
    };
    
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
        const goals = PPT.currentScenario.goals;
        for (let i = 0; i < goals.length; i++) {
            if (!G.goalsAchieved[i]) return { idx: i, goal: goals[i] };
        }
        return null;
    };
    
    PPT.game.checkGoals = function() {
        const scenario = PPT.currentScenario;
        const goals = scenario.goals;
        
        for (let i = 0; i < goals.length; i++) {
            if (!G.goalsAchieved[i] && G.guests >= goals[i].guests) {
                G.goalsAchieved[i] = true;
                G.money += goals[i].reward;
                G.boosts.push({ amt: scenario.boosts.goal.amount, ticks: scenario.boosts.goal.ticks });
                
                PPT.ui.showNotif(goals[i].name + ' achieved! +€' + goals[i].reward + ' reward!', 'achievement');
                PPT.audio.playSound('achievement');
                PPT.game.spawnConfetti();
                
                for (let j = 0; j < 15; j++) {
                    setTimeout(() => PPT.game.spawnParticle(Math.random() * 640, Math.random() * 192, 'coin'), j * 50);
                }
                
                PPT.ui.updateMoney();
                PPT.ui.updateGoals();
                PPT.ui.buildBuildItems();
                
                // Auto-save after goal achievement
                PPT.state.save();
            }
        }
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
            const quarterRun = Math.ceil(c.run / 4);
            
            if (quarterRun > 0 && !G.debugMode) {
                G.money -= quarterRun;
                PPT.game.spawnParticle(320, 192, 'neg', '-€' + quarterRun);
                PPT.ui.updateMoney();
            }
            
            // Night transition - park closes, reset guests, log history
            if (dp === 'night' && prevDp === 'evening') {
                G.history.push({ day: G.day, money: G.money, guests: G.guests, happiness: G.happiness });
                if (G.history.length > 30) G.history.shift();
                
                G.guestSprites = [];
                G.guests = 0;
                
                PPT.ui.showNotif(G.debugMode ? 'Night. Park closed. (Debug: no running costs)' : 'Night. Park closed.', 'info');
            }
        }
        
        // Daytime - generate guests and income
        if (dp !== 'night') {
            const gen = PPT.game.calcGuestGen();
            G.guestAcc += gen;
            const whole = Math.floor(G.guestAcc);
            if (whole > 0) {
                G.guestAcc -= whole;
                for (let i = 0; i < whole; i++) {
                    G.guests++;
                    G.money += eco.guestEntryFee;
                    PPT.game.spawnGuest();
                }
                PPT.ui.updateMoney();
            }
            
            // Food income: each food stall earns foodRevenuePerStall, capped by guest count
            const c = PPT.game.countBuildings();
            if (c.food > 0 && G.guests > 0) {
                const maxFoodIncome = c.food * eco.foodRevenuePerStall;
                const actualFoodIncome = Math.min(maxFoodIncome, G.guests);
                G.money += actualFoodIncome;
            }
        }
        
        // Update happiness
        G.happiness = PPT.game.calcHappiness();
        
        // Process boosts
        for (let i = G.boosts.length - 1; i >= 0; i--) {
            G.boosts[i].ticks--;
            if (G.boosts[i].ticks <= 0) G.boosts.splice(i, 1);
        }
        
        // Check tips and goals
        if (G.tick % 6 === 0) PPT.game.checkTips();
        PPT.game.checkGoals();
        
        // Day progression
        if (G.tick % tpd === 0) {
            G.day++;
            G.daysSinceLastBuild++;
            
            // Staleness check - 2 days without building
            if (G.daysSinceLastBuild >= 2 && !G.staleNotified) {
                G.staleNotified = true;
                PPT.ui.showNotif('Guests are bored! They haven\'t seen anything new in a while.', 'negative');
            }
            
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
