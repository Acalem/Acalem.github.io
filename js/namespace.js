/**
 * Pixel Park Paradise - Global Namespace
 * All game modules attach to this object to avoid global scope pollution
 */
const PPT = {
    // Version info
    version: '1.0.0',
    
    // Module containers
    config: {},      // Constants, colors, tile sizes
    scenarios: {},   // Available scenarios
    state: null,     // Current game state (G object)
    audio: {},       // Audio functions
    render: {},      // Drawing functions
    ui: {},          // UI functions
    game: {},        // Core game logic
    debug: {},       // Debug panel
    
    // Current scenario reference
    currentScenario: null,
    
    // Canvas contexts (set during init)
    ctx: {
        park: null,
        particle: null,
        confetti: null
    },
    
    // Utility functions
    utils: {
        /**
         * Seeded random number generator
         * @param {number} seed 
         * @returns {number} 0-1
         */
        seededRandom: function(seed) {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        },
        
        /**
         * Format currency with € symbol
         * @param {number} amount 
         * @returns {string}
         */
        formatMoney: function(amount) {
            var a = Math.round(amount);
            if (a >= 0) {
                return '\u20ac' + a.toLocaleString('en', { maximumFractionDigits: 0 });
            }
            return '-\u20ac' + Math.abs(a).toLocaleString('en', { maximumFractionDigits: 0 });
        },
        
        /**
         * Check if device is touch-capable
         * @returns {boolean}
         */
        isTouchDevice: function() {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        },
        
        /**
         * Check if screen is in portrait mode
         * @returns {boolean}
         */
        isPortrait: function() {
            return window.innerHeight > window.innerWidth;
        },
        
        /**
         * Detect device type based on screen size
         * @returns {string} 'mobile' | 'tablet' | 'desktop'
         */
        getDeviceType: function() {
            const width = window.innerWidth;
            if (width <= 480) return 'mobile';
            if (width <= 1024) return 'tablet';
            return 'desktop';
        }
    }
};

// Make PPT available globally
window.PPT = PPT;
