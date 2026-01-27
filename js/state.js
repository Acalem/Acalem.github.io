/**
 * Pixel Park Tycoon - State Management
 * Game state object and state initialization
 */

(function() {
    'use strict';
    
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
                daysSinceLastBuild: 0,
                staleNotified: false,
                
                // Tips/notifications
                lastTip: {},
                hints: {},
                
                // Animation
                frame: 0,
                
                // Debug history
                history: [],
                
                // Help modal state
                wasPlayingBeforeHelp: false
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
