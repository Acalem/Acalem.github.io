/**
 * Pixel Park Paradise - State Management
 * Game state object and state initialization
 */

(function() {
    'use strict';
    
    // Storage key prefix
    var SAVE_PREFIX = 'ppt_save_';
    
    /**
     * Create a fresh game state object
     * @param {object} scenario - The scenario configuration
     * @returns {object} New game state
     */
    PPT.state = {
        /**
         * Initialize a new game state from a scenario
         */
        create: function(scenario) {
            return {
                // Scenario reference
                scenarioId: scenario.id,
                
                // Core stats
                money: scenario.startMoney,
                guests: 0,
                guestAcc: 0,  // Guest accumulator for fractional guests
                happiness: 70,
                
                // Time
                tick: 6,  // Start at morning
                day: scenario.startDay,
                year: 1,
                paused: false,
                
                // Selection state
                selected: null,
                demolishMode: false,
                hover: null,
                
                // Settings
                sfx: true,
                music: true,
                debugMode: false,
                
                // World data
                grid: [],
                buildings: [],
                worldSeed: Date.now(),
                
                // Sprites and effects
                guestSprites: [],
                particles: [],
                confetti: [],
                birds: [],
                leaves: [],
                sparkles: [],
                
                // Gameplay
                boosts: [],
                goalsAchieved: scenario.goals.map(() => false),
                entryFee: 0,
                
                // Staff system
                staff: [],
                staffSprites: [],
                cleanliness: 100,
                rideBreakdowns: [],
                
                // Guest types
                guestTypeCounts: { thrillSeeker: 0, foodie: 0, family: 0, vip: 0 },
                inspectedGuest: null,
                carriedGuest: null,
                
                // Events system
                activeEffects: [],
                lastEvents: [],
                rain: [],
                
                // Finance tracking
                todayFinances: { entryFees: 0, foodRevenue: 0, runningCosts: 0, staffSalaries: 0, construction: 0, events: 0, rewards: 0 },
                financeHistory: [],
                
                // Price elasticity (computed each tick, not saved)
                fairPrice: 0,
                priceMod: 1,
                crowdFactor: 1,
                
                // Tips/notifications
                lastTip: {},
                hints: {},
                
                // Animation
                frame: 0,
                
                // Debug history
                history: [],
                
                // Help modal state
                wasPlayingBeforeHelp: false,
                wasPlayingBeforeRoadmap: false
            };
        },
        
        /**
         * Get the current game state
         */
        get: function() {
            return PPT._gameState;
        },
        
        /**
         * Set the current game state
         */
        set: function(state) {
            PPT._gameState = state;
        },
        
        /**
         * Reset to a fresh state with current scenario
         */
        reset: function() {
            if (PPT.currentScenario) {
                PPT._gameState = this.create(PPT.currentScenario);
            }
        },
        
        /**
         * Get the save key for a scenario
         */
        getSaveKey: function(scenarioId) {
            return SAVE_PREFIX + (scenarioId || 'unknown');
        },
        
        /**
         * Save the current game state to localStorage
         */
        save: function() {
            if (!PPT._gameState || !PPT._gameState.scenarioId) return false;
            
            try {
                // Extract only the data we need to persist
                var saveData = {
                    version: 1,
                    timestamp: Date.now(),
                    scenarioId: PPT._gameState.scenarioId,
                    
                    // Core stats
                    money: PPT._gameState.money,
                    guests: PPT._gameState.guests,
                    guestAcc: PPT._gameState.guestAcc,
                    happiness: PPT._gameState.happiness,
                    
                    // Time
                    tick: PPT._gameState.tick,
                    day: PPT._gameState.day,
                    year: PPT._gameState.year,
                    
                    // Settings (persist user preferences)
                    sfx: PPT._gameState.sfx,
                    music: PPT._gameState.music,
                    
                    // World data
                    grid: PPT._gameState.grid,
                    buildings: PPT._gameState.buildings,
                    worldSeed: PPT._gameState.worldSeed,
                    
                    // Gameplay progress
                    boosts: PPT._gameState.boosts,
                    goalsAchieved: PPT._gameState.goalsAchieved,
                    entryFee: PPT._gameState.entryFee,
                    
                    // Staff system
                    staff: PPT._gameState.staff,
                    cleanliness: PPT._gameState.cleanliness,
                    rideBreakdowns: PPT._gameState.rideBreakdowns,
                    
                    // Guest types
                    guestTypeCounts: PPT._gameState.guestTypeCounts,
                    
                    // Events
                    activeEffects: PPT._gameState.activeEffects,
                    lastEvents: PPT._gameState.lastEvents,
                    
                    // Finance tracking
                    todayFinances: PPT._gameState.todayFinances,
                    financeHistory: PPT._gameState.financeHistory,
                    
                    // History for debug panel
                    history: PPT._gameState.history
                };
                
                var key = this.getSaveKey(PPT._gameState.scenarioId);
                localStorage.setItem(key, JSON.stringify(saveData));
                return true;
            } catch (e) {
                console.warn('Failed to save game:', e);
                return false;
            }
        },
        
        /**
         * Load a saved game state for a scenario
         * @param {string} scenarioId - The scenario to load
         * @returns {object|null} The loaded state or null if no save exists
         */
        load: function(scenarioId) {
            try {
                var key = this.getSaveKey(scenarioId);
                var data = localStorage.getItem(key);
                
                if (!data) return null;
                
                var saveData = JSON.parse(data);
                
                // Validate save data
                if (!saveData || saveData.scenarioId !== scenarioId) {
                    return null;
                }
                
                return saveData;
            } catch (e) {
                console.warn('Failed to load save:', e);
                return null;
            }
        },
        
        /**
         * Check if a save exists for a scenario
         * @param {string} scenarioId - The scenario to check
         * @returns {boolean}
         */
        hasSave: function(scenarioId) {
            try {
                var key = this.getSaveKey(scenarioId);
                return localStorage.getItem(key) !== null;
            } catch (e) {
                return false;
            }
        },
        
        /**
         * Delete save for a scenario
         * @param {string} scenarioId - The scenario to clear
         */
        deleteSave: function(scenarioId) {
            try {
                var key = this.getSaveKey(scenarioId);
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.warn('Failed to delete save:', e);
                return false;
            }
        },
        
        /**
         * Restore game state from save data
         * @param {object} scenario - The scenario config
         * @param {object} saveData - The loaded save data
         * @returns {object} The restored game state
         */
        restoreFromSave: function(scenario, saveData) {
            // Start with a fresh state
            var state = this.create(scenario);
            
            // Restore saved values
            state.money = saveData.money;
            state.guests = saveData.guests || 0;
            state.guestAcc = saveData.guestAcc || 0;
            state.happiness = saveData.happiness;
            
            state.tick = saveData.tick;
            state.day = saveData.day;
            state.year = saveData.year || 1;
            
            state.sfx = saveData.sfx !== undefined ? saveData.sfx : true;
            state.music = saveData.music !== undefined ? saveData.music : true;
            
            state.grid = saveData.grid;
            state.buildings = saveData.buildings;
            state.worldSeed = saveData.worldSeed;
            
            // Ensure new behavior system fields on buildings (backward compat)
            if (state.buildings) {
                state.buildings.forEach(function(b) {
                    if (b.builtTick == null && !b.building) b.builtTick = 0;
                    if (b.current_visitors == null) b.current_visitors = 0;
                    if (b.sales_today == null) b.sales_today = 0;
                    if (b.revenue_today == null) b.revenue_today = 0;
                });
            }
            
            state.boosts = saveData.boosts || [];
            var savedGoals = saveData.goalsAchieved || [];
            state.goalsAchieved = scenario.goals.map(function(_, i) { return savedGoals[i] || false; });
            state.entryFee = saveData.entryFee ?? 0;
            
            // Staff system
            state.staff = saveData.staff || [];
            state.cleanliness = saveData.cleanliness ?? 100;
            state.rideBreakdowns = saveData.rideBreakdowns || [];
            
            // Guest types
            state.guestTypeCounts = saveData.guestTypeCounts || { thrillSeeker: 0, foodie: 0, family: 0, vip: 0 };
            
            // Events
            state.activeEffects = saveData.activeEffects || [];
            state.lastEvents = saveData.lastEvents || [];
            
            // Finance tracking
            state.todayFinances = saveData.todayFinances || { entryFees: 0, foodRevenue: 0, runningCosts: 0, staffSalaries: 0, construction: 0, events: 0, rewards: 0 };
            state.financeHistory = saveData.financeHistory || [];
            
            state.history = saveData.history || [];
            
            return state;
        }
    };
    
    // Shorthand getter - G references the current game state
    Object.defineProperty(window, 'G', {
        get: function() {
            return PPT._gameState;
        },
        set: function(val) {
            PPT._gameState = val;
        }
    });
    
})();
