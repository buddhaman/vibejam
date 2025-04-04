import * as THREE from 'three';

import { Level } from './Level';
import { StaticBody } from './StaticBody';
import { RigidBody } from './RigidBody';
import { Saw } from './Saw';
import { Game } from './Game';
import { LevelBuilder } from './LevelBuilder';
import { Sign } from './Sign';

export class TestLevels {
    // Parameter for main platform length that can be adjusted as needed
    private static mainPlatformLength = 80; // Default value to fit all portals (furthest is at z=40)
    
    /**
     * Creates an overworld hub with portals to different levels
     * @param level The Level instance to add level elements to
     * @param game The Game instance for level switching
     */
    public static createOverworld(level: Level, game: Game): void {
        const groundY = 12;

        // Main platform in the center - using the configurable mainPlatformLength
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-35, 0, -35),
            new THREE.Vector3(35, groundY, this.mainPlatformLength),
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "overworld-platform"
        ));
        
        // TUTORIAL SIDE - All tutorials and Jungle Gym in one row
        // =====================================================
        
        // Level 1 portal - Jungle Gym (first in line)
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(-25, groundY + 2, -15),   // Left position
            3,                                  // Level ID
            "Jungle Gym",                       // Name
            "Playground",                       // Description
            "white",                            // Text color
            "#aaffaa",                          // Description color
            false,                                // Show highscore
        );
        
        // Tutorial level portal (middle)
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(-25, groundY + 2, -5),   // Middle position
            1,                                  // Level ID
            "Tutorial",                         // Name
            "For Beginners",                    // Description
            "white",                            // Text color
            "#aaffaa",                          // Description color
            false                               // No highscore for tutorial
        );
        
        // Advanced tutorial level portal (right)
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(-25, groundY + 2, 5),   // Right position
            2,                                  // Level ID
            "Tutorial 2",                       // Name
            "Advanced",                         // Description
            "white",                            // Text color
            "#ffaaaa",                          // Description color
            false                               // No highscore for tutorial
        );
        
        // Add text above the tutorial section
        level.levelRenderer?.addSimpleText(
            "TUTORIALS & PLAYGROUND",
            new THREE.Vector3(-15, groundY + 6, -15),
            "white",
            "#000000"
        );
        
        // GAMEPLAY LEVELS SIDE - All other levels on the opposite side
        // =====================================================

        // Level 4
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(20, groundY + 2, 25),    // Position on opposite side
            4,                                  // Level ID
            "Simple level",                        // Name
            ":)",                        // Description
            "white",                            // Text color
            "#ffff88",                          // Description color
            true                                // Show highscore
        );
        

        // Level 4 portal - Skydiving
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(20, groundY + 2, 10),    // Position on opposite side
            5,                                  // Level ID
            "Drop level",                        // Name
            "Okay",                        // Description
            "white",                            // Text color
            "#ffff88",                          // Description color
            true                                // Show highscore
        );

        // Level 4 portal - First Level
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(20, groundY + 2, -5),    // Position on opposite side
            6,                                  // Level ID
            "Blocks",                        // Name
            "Tricky between saws",                        // Description
            "white",                            // Text color
            "#ffff88",                          // Description color
            true                                // Show highscore
        );

        // Level 7
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(20, groundY + 2, 40),    // Position on opposite side
            7,                                  // Level ID
            "Long level",                        // Name
            "But doable",                        // Description
            "white",                            // Text color
            "#ffff88",                          // Description color
            true                                // Show highscore
        );

        // Level skydiving
        this.createLevelPortal(
            level,
            game,
            new THREE.Vector3(20, groundY + 2, 55),    // Position on opposite side
            8,                                  // Level ID 
            "Sky diving",                        // Name
            "DIFFICULT",                        // Description
            "white",                            // Text color
            "#ffff88",                          // Description color
            true                                // Show highscore
        );
        
        // Add text above game levels section
        level.levelRenderer?.addSimpleText(
            "GAME LEVELS",
            new THREE.Vector3(15, groundY + 6, 15),
            "white",
            "#000000"
        );
        
        // Create a separate island for the Vibeverse portal
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-5, 0, -60),
            new THREE.Vector3(15, groundY, -40),
            new THREE.MeshStandardMaterial({
                color: 0x6699ff,          // Light blue for Vibeverse island
                roughness: 0.4,
                metalness: 0.5,
                emissive: 0x6699ff,
                emissiveIntensity: 0.1,
            }),
            "vibeverse-island"
        ));
        
        // Create a bridge connecting main platform to Vibeverse island
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(0, 0, -40),
            new THREE.Vector3(5, groundY, -35),  // Changed -25 to -35
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "vibeverse-bridge"
        ));
        
        // Add some decorative elements to the bridge
        for (let i = 0; i < 3; i++) {  // Reduced from 5 to 3 elements to fit the shorter bridge
            // Left side railings
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(0, groundY, -39 + i * 1.5),  // Changed spacing from 3 to 1.5
                new THREE.Vector3(0.5, groundY + 2, -38 + i * 1.5),
                LevelBuilder.PORTAL_MATERIAL,
                `bridge-rail-left-${i}`
            ));
            
            // Right side railings
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(4.5, groundY, -39 + i * 1.5),  // Changed spacing from 3 to 1.5
                new THREE.Vector3(5, groundY + 2, -38 + i * 1.5),
                LevelBuilder.PORTAL_MATERIAL,
                `bridge-rail-right-${i}`
            ));
        }
        
        // Add Vibeverse portal on the separate island
        this.createVibeVersePortal(level, game);
        
        // Add bridge signage
        level.levelRenderer?.addSimpleText(
            "TO VIBEVERSE",
            new THREE.Vector3(2.5, groundY + 3, -37),  // Changed from -30 to -37
            "#ffff00",
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "→",
            new THREE.Vector3(2.5, groundY + 2, -38.5),  // Changed from -33 to -38.5
            "#ffff00",
            "#000000"
        );
        
        // Main overworld text
        level.levelRenderer?.addSimpleText(
            "OVERWORLD HUB",
            new THREE.Vector3(0, groundY + 8, 0),
            "white",
            "#000000"
        );
        
        level.playerStartPosition = new THREE.Vector3(0, groundY + 3, 0);
        
        // Check for incoming portal traffic and position player appropriately
        this.handleIncomingPortalTraffic(level, game);
        
        console.log("Overworld hub created with portals to different levels and Vibeverse bridge");
        
        // Update all highscore signs after a short delay to ensure they're properly initialized
        setTimeout(() => {
            console.log("Updating all highscore signs...");
            if (level.signs && level.signs.length > 0) {
                level.signs.forEach(sign => {
                    const levelId = sign.getLevelId();
                    
                    // If network is available, populate with current highscores
                    if (game.network) {
                        const highscores = game.network.getHighscores(levelId);
                        
                        if (highscores && highscores.length > 0) {
                            sign.setHighscores(highscores);
                        } else {
                            game.network.requestAllHighscores();
                            sign.setHighscores(game.network.getHighscores(levelId));
                        }
                    } else {
                        sign.setHighscores([]);
                    }
                });
            }
        }, 1000); // 1 second delay
    }
    
    /**
     * Creates a Vibeverse portal that connects to other games
     * @param level The Level instance to add the portal to
     * @param game The Game instance for handling portal interactions
     */
    private static createVibeVersePortal(level: Level, game: Game): void {
        // Get the groundY value from the level
        const groundY = 12; // This should match the value used in createOverworld
        
        // Create a special material for the Vibeverse portal
        const vibeverseMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,          // Cyan color
            roughness: 0.2,
            metalness: 0.9,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,   // Brighter glow
        });
        
        // Calculate center position of the island
        const islandCenterX = 5;  // Center of island from -5 to 15
        const islandCenterZ = -50; // Center of island from -60 to -40
        
        // Create a smaller central portal structure on the Vibeverse island
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(islandCenterX - 1, groundY, islandCenterZ - 1),
            new THREE.Vector3(islandCenterX + 1, groundY + 6, islandCenterZ + 1),
            vibeverseMaterial,
            "vibeverse-portal"
        ));
        
        // Left pillar - positioned relative to portal center
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(islandCenterX - 4, groundY, islandCenterZ - 1),
            new THREE.Vector3(islandCenterX - 3, groundY + 10, islandCenterZ + 1),
            LevelBuilder.PORTAL_MATERIAL,
            "vibeverse-pillar-left"
        ));
        
        // Right pillar - positioned relative to portal center
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(islandCenterX + 3, groundY, islandCenterZ - 1),
            new THREE.Vector3(islandCenterX + 4, groundY + 10, islandCenterZ + 1),
            LevelBuilder.PORTAL_MATERIAL,
            "vibeverse-pillar-right"
        ));
        
        // Top arch - connecting both pillars
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(islandCenterX - 4, groundY + 9, islandCenterZ - 1),
            new THREE.Vector3(islandCenterX + 4, groundY + 10, islandCenterZ + 1),
            LevelBuilder.PORTAL_MATERIAL,
            "vibeverse-arch"
        ));
        
        // Make the action area larger to make it easier to enter
        level.addActionArea(
            new THREE.Vector3(islandCenterX, groundY + 4, islandCenterZ),  // Center of the portal
            new THREE.Vector3(10, 12, 6),     // Larger interaction area (was 8,10,4)
            () => {
                console.log("Entering Vibeverse Portal");
                
                // Get actual player information for the portal URL
                const player = level.localPlayer;
                let username = "player" + Math.floor(Math.random() * 1000); // Default random username
                let color = "pink"; // Default color
                let speed = "5"; // Default movement speed
                let playerPos = new THREE.Vector3(0, 0, 0);
                let playerDir = new THREE.Vector3(0, 0, 1);
                let playerVel = new THREE.Vector3(0, 0, 0);
                
                if (player) {
                    // If player has a username, use it
                    if (player.username) {
                        username = player.username;
                    }
                    
                    // Use player's color
                    color = player.color.getHexString();
                    
                    // Convert internal movement speed to portal speed
                    speed = (player.moveSpeed * 40).toFixed(1);
                    
                    // Get player position and forward vector
                    playerPos = player.getPosition();
                    playerDir = player.forward.clone().normalize();
                    
                    // Create velocity based on player's current movement direction and speed
                    playerVel = player.lastMovementDir.clone().multiplyScalar(parseFloat(speed));
                }
                
                // Current URL as reference for return journey
                const ref = encodeURIComponent(window.location.href);
                
                // Calculate rotations from forward vector
                const yRotation = Math.atan2(playerDir.x, playerDir.z);
                
                // Build portal URL with all parameters
                const params = new URLSearchParams();
                params.append('username', username);
                params.append('color', color);
                params.append('speed', speed);
                params.append('ref', ref);
                
                // Include position
                params.append('position_x', playerPos.x.toFixed(2));
                params.append('position_y', playerPos.y.toFixed(2));
                params.append('position_z', playerPos.z.toFixed(2));
                
                // Include velocity components
                params.append('speed_x', playerVel.x.toFixed(2));
                params.append('speed_y', playerVel.y.toFixed(2));
                params.append('speed_z', playerVel.z.toFixed(2));
                
                // Include rotation
                params.append('rotation_y', yRotation.toFixed(2));
                
                // Include team (our game's theme color)
                params.append('team', 'pink');
                
                // Add avatar info if we have it
                if (player && player.username) {
                    params.append('avatar_url', `https://avatars.dicebear.com/api/bottts/${player.username}.svg`);
                }
                
                // Add portal=true parameter
                params.append('portal', 'true');
                
                // Build the final URL
                const portalUrl = `http://portal.pieter.com/?${params.toString()}`;
                
                console.log("Redirecting to Vibeverse: " + portalUrl);
                
                // Use the external portal transition since we're going to a different domain
                game.transitionToExternalPortal(portalUrl);
            }
        );
        
        // Add descriptive text and floating elements
        level.levelRenderer?.addSimpleText(
            "VIBEVERSE PORTAL",
            new THREE.Vector3(islandCenterX, groundY + 11, islandCenterZ),
            "#00ffff", // Cyan
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "CONNECT TO THE METAVERSE",
            new THREE.Vector3(islandCenterX, groundY + 9.5, islandCenterZ),
            "white",
            "#000000"
        );
        
        // Add floating arrow pointing down at the portal
        this.createFloatingArrow(level, new THREE.Vector3(islandCenterX, groundY + 12, islandCenterZ));
    }
    
    /**
     * Handles incoming traffic from other games via the portal system
     * @param level The Level instance
     * @param game The Game instance
     */
    private static handleIncomingPortalTraffic(level: Level, game: Game): void {
        // Check if player arrived via portal using Game's stored data
        if (game.isPlayerFromPortal()) {
            console.log("Player is coming from a portal!");
            
            // Get the referring game URL from Game
            const refUrl = game.getPortalReferrer();
            
            if (refUrl) {
                // Create a special material for the return portal - brighter and more noticeable
                const returnPortalMaterial = new THREE.MeshStandardMaterial({
                    color: 0xff00ff,        // Magenta color
                    roughness: 0.2,
                    metalness: 0.9,
                    emissive: 0xff00ff,
                    emissiveIntensity: 0.9,  // Higher emissive for more glow
                });
                
                // Create the return portal structure - make it slightly larger and more noticeable, place in corner
                level.addStaticBody(StaticBody.createBox(
                    new THREE.Vector3(-22, 2, -22),  // Move to far corner of main platform
                    new THREE.Vector3(-18, 9, -18),  // Taller portal
                    returnPortalMaterial,
                    "return-portal"
                ));
                
                // Add action area for the return portal
                level.addActionArea(
                    new THREE.Vector3(-20, 5, -20),  // Center of the portal
                    new THREE.Vector3(8, 10, 8),     // Large interaction area
                    () => {
                        console.log("Returning to previous game");
                        
                        // Use Game's method to build the proper return URL with all parameters
                        const returnUrl = game.buildPortalReturnUrl();
                        
                        if (returnUrl) {
                            // Use external portal transition method for return journey to a different domain
                            game.transitionToExternalPortal(returnUrl);
                        } else {
                            console.error("Failed to build return URL");
                            // Fallback to direct referrer if URL building failed
                            if (refUrl) {
                                game.transitionToExternalPortal(refUrl);
                            }
                        }
                    }
                );
                
                // Get an abbreviated version of the referrer URL for display
                let displayUrl = refUrl;
                try {
                    const urlObj = new URL(refUrl);
                    displayUrl = urlObj.hostname;
                } catch (e) {
                    // Keep the original URL if parsing fails
                }
                
                // Position player at a safer distance from the portal to prevent immediate activation
                // Also move player position to match the new portal location
                if (level.localPlayer) {
                    level.localPlayer.setPosition(new THREE.Vector3(-20, 5, -10));
                }
                
                // Update all text positions
                level.levelRenderer?.addSimpleText(
                    "RETURN PORTAL",
                    new THREE.Vector3(-20, 9.5, -20),
                    "white",
                    "#000000"
                );
                
                level.levelRenderer?.addSimpleText(
                    "YOU ENTERED HERE",
                    new THREE.Vector3(-20, 8.5, -20),
                    "#ffff00", // Bright yellow
                    "#000000"
                );
                
                level.levelRenderer?.addSimpleText(
                    `BACK TO: ${displayUrl}`,
                    new THREE.Vector3(-20, 7.5, -20),
                    "#00ffff", // Cyan text
                    "#000000"
                );
                
                // Update arrow position
                this.createFloatingArrow(level, new THREE.Vector3(-20, 11, -20));
                
                // Additional welcome message
                level.levelRenderer?.addSimpleText(
                    `WELCOME ${game.getPortalParameter('username') || 'PLAYER'}!`,
                    new THREE.Vector3(0, 12, 0),
                    "white",
                    "#000000"
                );
                
                // Add another message showing origin portal details
                if (game.getPortalParameter('ref')) {
                    level.levelRenderer?.addSimpleText(
                        `FROM: ${game.getPortalParameter('ref')}`,
                        new THREE.Vector3(0, 11, 0),
                        "#aaffaa",
                        "#000000"
                    );
                }
            }
        }
    }
    
    /**
     * Create a floating arrow pointing to a location
     * @param level The level to add the arrow to
     * @param position The position to point to
     */
    private static createFloatingArrow(level: Level, position: THREE.Vector3): void {
        // Only create if we have a renderer
        if (!level.levelRenderer) return;
        
        // Create a downward pointing arrow using a triangle
        const arrowMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1.0,
            side: THREE.DoubleSide
        });
        
        // Create arrow geometry (simple triangle pointing down)
        const arrowGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -0.5, 0, 0,  // left
             0.5, 0, 0,  // right
             0, -1.5, 0  // bottom
        ]);
        
        arrowGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        arrowGeo.computeVertexNormals();
        
        const arrow = new THREE.Mesh(arrowGeo, arrowMaterial);
        arrow.position.copy(position);
        
        // Add to scene
        level.levelRenderer.scene.add(arrow);
        
        // Setup animation for bobbing up and down
        const startY = position.y;
        const bobHeight = 0.5;
        const bobSpeed = 0.02;
        
        // Store the animation timing
        let time = 0;
        
        // Create an update function that will be called each frame
        const updateArrow = () => {
            time += bobSpeed;
            
            // Bob up and down
            arrow.position.y = startY + Math.sin(time) * bobHeight;
            
            // Rotate slowly around Y axis
            arrow.rotation.y += 0.01;
            
            // Request next update
            requestAnimationFrame(updateArrow);
        };
        
        // Start the animation loop
        updateArrow();
    }

    /**
     * Creates the Jungle Gym test level with all platforms, ropes, and obstacles
     * @param level The Level instance to add level elements to
     * @param game The Game instance for level switching
     */
    public static createJungleGymTest(level: Level, game: Game): void {
        // Use the same materials for consistency
        TestLevels.createStaticPlatforms(level);
        TestLevels.createDynamicPlatforms(level);
        TestLevels.createRopes(level);
        TestLevels.createSaws(level);

        // Add portal back to overworld
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-12, 2, -12),
            new THREE.Vector3(-10, 6, -10),
            LevelBuilder.PORTAL_MATERIAL,
            "portal-overworld"
        ));

        // Add action area for the portal
        level.addActionArea(
            new THREE.Vector3(-11, 4, -11),    // Center of the portal
            new THREE.Vector3(6, 8, 6),        // Same size as overworld portals
            () => {
                console.log("Returning to Overworld");
                if (game) {
                    game.switchLevel(0);  // 0 represents the overworld
                }
            }
        );

        // Add descriptive text above portal
        level.levelRenderer?.addSimpleText(
            "OVERWORLD",
            new THREE.Vector3(-11, 7, -11),
            "white",
            "#000000"
        );
    }
    
    /**
     * Create all static platforms and structures
     */
    private static createStaticPlatforms(level: Level): void {
        // Use the global materials
        const platformMaterial = LevelBuilder.MAIN_PLATFORM_MATERIAL;
        const obstacleMaterial = LevelBuilder.PORTAL_MATERIAL;

        // STARTING AREA
        // =============
        // Starting platform at y=2 with stairs
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 0, -15),
            new THREE.Vector3(15, 2, 15),
            platformMaterial,
            "starting-platform"
        ));
        
        // Staircase down from starting platform (4 steps)
        for (let i = 0; i < 4; i++) {
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(15 + i*2, 0, -4),
                new THREE.Vector3(17 + i*2, 2 - i*0.5, 4),
                platformMaterial,
                `stair-${i}`
            ));
        }
        
        // OBSTACLE COURSE
        // ==============
        
        // Create a series of platforms with increasing gaps
        const platformCount = 5;
        let lastX = 25;
        
        for (let i = 0; i < platformCount; i++) {
            const platformSize = 4 - i * 0.5; // Platforms get smaller
            const gap = 3 + i * 0.7; // Gaps get larger
            
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(lastX, 0, -platformSize),
                new THREE.Vector3(lastX + platformSize, 1, platformSize),
                platformMaterial,
                `jump-platform-${i}`
            ));
            
            lastX += platformSize + gap;
        }
        
        // VERTICAL CHALLENGE
        // =================
        
        // Create a tower with spiraling platforms
        const towerRadius = 10;
        const towerHeight = 40;
        const platformsPerRotation = 12;
        const totalSpirals = 24
        
        // Create central column
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-3, 0, -30),
            new THREE.Vector3(3, towerHeight, -24),
            obstacleMaterial,
            "tower-column"
        ));
        
        // Create spiral platforms
        for (let i = 0; i < totalSpirals; i++) {
            const angle = (i / platformsPerRotation) * Math.PI * 2;
            const height = (i / totalSpirals) * towerHeight;
            const radius = towerRadius - (i / totalSpirals) * 5; // Spiral gets tighter
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius - 27; // Center at z=-27
            
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(x - 2.5, height, z - 2.5),
                new THREE.Vector3(x + 2.5, height + 1.0, z + 2.5),
                platformMaterial,
                `spiral-platform-${i}`
            ));
        }
        
        // HIGH CHALLENGE AREA
        // ==================
        
        // Bridge to elevated challenge area
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-2, towerHeight, -40),
            new THREE.Vector3(2, towerHeight + 1, -34),
            platformMaterial,
            "high-bridge"
        ));
        
        // Elevated challenge area with moving platforms (visual only, not actually moving)
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, towerHeight, -60),
            new THREE.Vector3(15, towerHeight + 1, -40),
            platformMaterial,
            "challenge-area"
        ));
        
        // Floating obstacle blocks
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 20 - 10;
            const z = Math.random() * 15 - 55;
            const size = Math.random() * 2 + 1;
            
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(x - size/2, towerHeight + 3, z - size/2),
                new THREE.Vector3(x + size/2, towerHeight + 3 + size, z + size/2),
                obstacleMaterial,
                `floating-obstacle-${i}`
            ));
        }
        
        // FINAL AREA - HIGH PLATFORM
        // =========================
        
        // Keep the high platform at y=100 as the final challenge/destination
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 100, -15),
            new THREE.Vector3(15, 102, 15),
            new THREE.MeshStandardMaterial({
                color: 0xffd700, // Gold color for the final platform
                roughness: 0.3,
                metalness: 0.8
            }),
            "final-platform"
        ));
        
        // Add a teleporter visual hint to reach the final platform (not functional, just visual)
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-1, towerHeight + 1, -50),
            new THREE.Vector3(1, towerHeight + 5, -48),
            new THREE.MeshStandardMaterial({
                color: 0xffaa00,
                roughness: 0.3,
                metalness: 0.8,
                emissive: 0xffaa00,
                emissiveIntensity: 0.5
            }),
            "teleporter-visual"
        ));
    }
    
    /**
     * Create dynamic moving platforms
     */
    private static createDynamicPlatforms(level: Level): void {
        // Use variations of the main colors for moving platforms
        const redMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            emissive: 0xff3366,
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.6
        });
        
        const blueMaterial = new THREE.MeshStandardMaterial({
            color: 0x3366ff, emissive: 0x3366ff, emissiveIntensity: 0.2,
            roughness: 0.4, metalness: 0.6
        });
        
        const greenMaterial = new THREE.MeshStandardMaterial({
            color: 0x33ff66, emissive: 0x33ff66, emissiveIntensity: 0.2,
            roughness: 0.4, metalness: 0.6
        });
        
        const purpleMaterial = new THREE.MeshStandardMaterial({
            color: 0x9932cc,
            emissive: 0x9932cc,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.7
        });
        
        // Constants for fixed physics behavior (never scaled by deltaTime)
        const HORIZONTAL_VELOCITY = 0.05;
        const VERTICAL_VELOCITY = 0.04;
        const ROTATION_VELOCITY = 0.02;
        const FAST_ROTATION_VELOCITY = 0.02; // Faster rotation for the flipping platform
        
        // 1. Horizontal moving platform - BIGGER
        const horizontalPlatform = RigidBody.createBox(
            new THREE.Vector3(-8, 2.2, 0),
            new THREE.Vector3(8, 1.2, 8), // Increased size
            15.0, // Increased mass
            redMaterial
        );
        horizontalPlatform.velocity.set(HORIZONTAL_VELOCITY, 0, 0);
        level.addDynamicBody(horizontalPlatform);
        
        // 2. Vertical moving platform - BIGGER
        const verticalPlatform = RigidBody.createBox(
            new THREE.Vector3(0, 2.7, -8),
            new THREE.Vector3(8, 0.8, 8), // Increased size
            15.0, // Increased mass
            blueMaterial
        );
        verticalPlatform.velocity.set(0, VERTICAL_VELOCITY, 0);
        level.addDynamicBody(verticalPlatform);

        // 3. Fast X-axis rotating platform (to flip the player)
        // const flippingPlatform = RigidBody.createBox(
        //     new THREE.Vector3(0, 3.5, 8), // Position it on the positive Z side
        //     new THREE.Vector3(6, 2, 25), // Long but narrow platform for better flipping
        //     12.0,
        //     purpleMaterial
        // );
        
        // // Set fast rotation on X axis to create the flipping effect
        // flippingPlatform.angularVelocity.set(FAST_ROTATION_VELOCITY, 0, 0);
        // level.addDynamicBody(aflippingPlatform);

        level.levelRenderer?.addSimpleText(
            "Hello World!",
            new THREE.Vector3(0, 10, 0),
            "white",
            "black"
        );
    }
    
    /**
     * Create ropes for the player to climb
     */
    private static createRopes(level: Level): void {
        // Create a few test ropes at different locations
        level.addRope(
            new THREE.Vector3(5, 25, 0),    // Higher fixed point
            15,                             // More segments
            20,                             // Longer length
            0.2,                            // Thicker radius
            0xff2222                        // Red color
        );
        
        let rope = level.addRope(
            new THREE.Vector3(-5, 30, 3),   // Higher fixed point
            15,                             // More segments
            20,                             // Longer length
            0.2,                            // Thicker radius
            0x22ff22                        // Green color
        );
        rope.endParticle.applyImpulse(new THREE.Vector3(0, 0, 10));
        
        // Add a rope from the final platform
        level.addRope(
            new THREE.Vector3(0, 102, 0),   // From top of the gold platform
            30,                             // More segments for longer rope
            30,                             // Much longer length
            0.2,                            // Thicker radius
            0xffff22                        // Yellow color
        );
    }
    
    /**
     * Create dangerous saw obstacles
     */
    private static createSaws(level: Level): void {
        // Create a single test saw
        const testSaw = new Saw(
            new THREE.Vector3(10, 8, 0),  // Position
            4.0,                          // Radius
            0.8,                          // Thickness
            0.05                          // Spin speed
        );
        level.addSaw(testSaw);
    }



    /**
     * Creates a simple test level with two platforms and a rope for swinging
     * @param level The Level instance to add level elements to
     */
    public static createSkydivingChallenge(level: Level, game: Game): void {

        level.playerStartPosition = new THREE.Vector3(0, 105, 0);
        // Starting platform - high up
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(0, 100, 0),    // Center position - very high up
            30,                              // Width
            30,                              // Depth
            3,                               // Height
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "platform-start"
        );
        
        // First lower platform with updraft
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(40, 20, 0),    // Center position - much lower
            15,                              // Width
            15,                              // Depth
            2,                               // Height
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "platform-updraft-1"
        );

        // First updraft - strong enough to boost player high
        level.addUpdraft(
            new THREE.Vector3(40, 50, 0),    // Position centered on first platform
            new THREE.Vector3(12, 60, 12),   // Size - tall enough to catch falling player
            0.15                             // Strength - stronger to lift player high
        );

        // Second lower platform with updraft
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(80, 15, 0),    // Center position - even lower
            15,                              // Width
            15,                              // Depth
            2,                               // Height
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "platform-updraft-2"
        );

        // Second updraft
        level.addUpdraft(
            new THREE.Vector3(80, 50, 0),    // Position centered on second platform
            new THREE.Vector3(12, 70, 12),   // Size - even taller
            0.17                             // Strength - slightly stronger
        );

        // Rope for final swing - positioned after second updraft
        const rope = level.addRope(
            new THREE.Vector3(120, 70, 0),   // Anchor point high up after second updraft
            15,                              // More segments for smoother swing
            25,                              // Length - long enough to catch while falling
            0.3,                             // Thicker radius for better visibility
            0xffdd22                         // Yellow-orange color
        );

        // Rope for final swing - positioned after second updraft
        const rope2 = level.addRope(
            new THREE.Vector3(140, 70, 0),   // Anchor point high up after second updraft
            15,                              // More segments for smoother swing
            25,                              // Length - long enough to catch while falling
            0.3,                             // Thicker radius for better visibility
            0xffdd22                         // Yellow-orange color
        );

        // Final platform with action area
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(180, 32, 0),   // Center position
            25,                              // Width
            25,                              // Depth
            8,                               // Height
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "platform-final"
        );
        
        // Action area on final platform
        level.addActionArea(
            new THREE.Vector3(180, 38, 0),   // Center of final platform, slightly above
            new THREE.Vector3(10, 4, 10),    // Size of the trigger area
            () => {
                console.log("Congratulations! You completed the skydiving challenge!");
                level.levelRenderer?.addSimpleText(
                    "Congratulations! You completed the skydiving challenge!",
                    new THREE.Vector3(160, 44, 0),
                    "white",
                    "black"
                );
                // Switch to overworld after showing the congratulations message
                level.levelFinished();
            },
            true  // Set triggerOnce to true
        );

        // Position player on the starting platform
        level.localPlayer?.setPosition(new THREE.Vector3(0, 104, 0));
        
        console.log("Skydiving challenge level created with updrafts and rope swing");
    }

    /**
     * Utility function to create a level portal with accompanying highscore sign
     * @param level The Level instance to add the portal to
     * @param game The Game instance for level switching
     * @param position The position of the portal (center position)
     * @param targetLevelId The level ID to switch to when portal is activated
     * @param portalName A display name for the portal
     * @param description Optional additional description text
     * @param textColor Optional color for the portal name text
     * @param descColor Optional color for the description text
     * @param showHighscore Optional boolean to control highscore sign creation
     */
    private static createLevelPortal(
        level: Level,
        game: Game,
        position: THREE.Vector3,
        targetLevelId: number,
        portalName: string,
        description: string = "",
        textColor: string = "white",
        descColor: string = "#aaffaa",
        showHighscore: boolean = true  // New parameter to control highscore sign creation
    ): void {
        // Create portal cube (3x4x3 size centered on position)
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(position.x - 1.5, position.y - 2, position.z - 1.5),
            new THREE.Vector3(position.x + 1.5, position.y + 2, position.z + 1.5),
            LevelBuilder.PORTAL_MATERIAL,
            `portal-level${targetLevelId}`
        ));
        
        // Make action area for portal
        const actionAreaSize = new THREE.Vector3(6, 8, 6);
        level.addActionArea(
            // Calculate center so ground = position.y
            new THREE.Vector3(position.x, position.y + actionAreaSize.y / 4, position.z),
            actionAreaSize,
            () => {
                console.log(`Switching to Level ${targetLevelId} (${portalName})`);
                if (game) {
                    game.switchLevel(targetLevelId);
                }
            }
        );
        
        // Add portal name text
        level.levelRenderer?.addSimpleText(
            portalName.toUpperCase(),
            new THREE.Vector3(position.x, position.y + 3, position.z),
            textColor,
            "#000000"
        );
        
        // Add optional description text
        if (description) {
            level.levelRenderer?.addSimpleText(
                description.toUpperCase(),
                new THREE.Vector3(position.x, position.y + 2, position.z),
                descColor,
                "#000000"
            );
        }
        
        // Create highscore sign for this level if we're in the overworld and showHighscore is true
        if (level.levelIdx === 0 && targetLevelId > 0 && showHighscore) {
            console.log(`Creating highscore sign for level ${targetLevelId}`);
            
            // Create a sign positioned next to the portal
            // Position for the sign (accounting for the 4x scale in Sign.ts)
            const signPos = new THREE.Vector3(
                position.x + 8,                // Position to the right of the portal
                position.y + 8,                // Ground level
                position.z                     // Same z as portal
            );

            // Use fixed rotation to make sure the sign faces the player
            const signRot = new THREE.Euler(0, -Math.PI / 2, 0);  // Simple 90 degree rotation
            
            // Create the sign for this level
            const sign = level.addSign(
                signPos,
                signRot,
                3.5,                        // Width (will be scaled 4x in Sign constructor)
                4.5,                        // Height (will be scaled 4x in Sign constructor)
                targetLevelId               // Level ID to show highscores for
            );
        }
    }
}