/**
 * Pixel Park Tycoon - Configuration
 * Game constants, color palette, and base definitions
 */

(function() {
    'use strict';
    
    // Grid and tile settings
    PPT.config.TILE_SIZE = 32;
    PPT.config.GRID_WIDTH = 20;
    PPT.config.GRID_HEIGHT = 12;
    
    // Day/time settings
    PPT.config.TICKS_PER_DAY = 84;
    PPT.config.DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Day period boundaries (as percentage of TICKS_PER_DAY)
    // night(0-7%) -> morning(7-36%) -> afternoon(36-64%) -> evening(64-93%) -> night(93-100%)
    PPT.config.DAY_PERIODS = {
        night1End: 0.07,      // ~6 ticks at 84
        morningEnd: 0.36,     // ~30 ticks at 84
        afternoonEnd: 0.64,   // ~54 ticks at 84
        eveningEnd: 0.93      // ~78 ticks at 84
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
    
    // Guest colors for sprite variation
    PPT.config.GUEST_COLORS = ['#ff7dad', '#5da6ff', '#7bdb87', '#ffe94d', '#c7a4f6', '#84d7fc', '#ff9c52', '#ff7b7b'];
    PPT.config.HAIR_COLORS = ['#6c5043', '#3c2820', '#ffe94d', '#ff7b7b', '#2a2a3e', '#9b6a3b'];
    
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
    PPT.config.PATH_TYPES = ['path', 'asphalt', 'wooden-path', 'sand-path', 'gravel-path', 'tiles', 'entrance'];
    
    // Tree types for world generation
    PPT.config.TREE_TYPES = ['tree-oak', 'tree-pine', 'tree-cherry'];
    
})();
