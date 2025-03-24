import * as THREE from 'three';
import { Level } from './Level';
import { StaticBody } from './StaticBody';
import { RigidBody } from './RigidBody';
import { Saw } from './Saw';
import { Game } from './Game';
import { ConvexShape } from '../../shared/ConvexShape';

export class TestLevels {
    // Global materials that match our pink theme
    private static readonly MAIN_PLATFORM_MATERIAL = new THREE.MeshStandardMaterial({
        color: 0xff3366,          // Vibrant pink-red
        roughness: 0.4,
        metalness: 0.3,
        emissive: 0xff3366,
        emissiveIntensity: 0.2,
    });

    private static readonly PORTAL_MATERIAL = new THREE.MeshStandardMaterial({
        color: 0x9932cc,          // Dark orchid purple
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x9932cc,
        emissiveIntensity: 0.6
    });

    /**
     * Helper function to create a platform using center position and size
     * @param level The Level instance to add the platform to
     * @param center Center position of the platform
     * @param size Size of the platform (width, height, depth)
     * @param material Optional material (defaults to main platform material)
     * @param name Optional name for the platform
     * @returns The created static body
     */
    private static createPlatform(
        level: Level,
        center: THREE.Vector3,
        size: THREE.Vector3,
        material: THREE.Material = this.MAIN_PLATFORM_MATERIAL,
        name: string = "platform"
    ): StaticBody {
        // Calculate min and max points from center and size
        const min = new THREE.Vector3(
            center.x - size.x / 2,
            center.y - size.y / 2,
            center.z - size.z / 2
        );
        const max = new THREE.Vector3(
            center.x + size.x / 2,
            center.y + size.y / 2,
            center.z + size.z / 2
        );

        return level.addStaticBody(StaticBody.createBox(min, max, material, name));
    }

    /**
     * Helper function to create a platform using center position, size, and orientation
     * @param level The Level instance to add the platform to
     * @param center Center position of the platform
     * @param size Size of the platform (width, height, depth)
     * @param orientation Orientation in radians (x, y, z rotation)
     * @param material Optional material (defaults to main platform material)
     * @param name Optional name for the platform
     * @returns The created static body
     */
    private static createOrientedPlatform(
        level: Level,
        center: THREE.Vector3,
        size: THREE.Vector3,
        orientation: THREE.Vector3,
        material: THREE.Material = this.MAIN_PLATFORM_MATERIAL,
        name: string = "oriented_platform"
    ): StaticBody {
        // Create a box shape centered at origin
        const halfSize = size.clone().multiplyScalar(0.5);
        const min = new THREE.Vector3(-halfSize.x, -halfSize.y, -halfSize.z);
        const max = new THREE.Vector3(halfSize.x, halfSize.y, halfSize.z);
        
        // Create the shape and set its orientation
        const shape = ConvexShape.createBox(min, max);
        const rotation = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(orientation.x, orientation.y, orientation.z)
        );
        shape.orientation.copy(rotation);
        shape.setPosition(center);
        shape.updateTransform();
        
        // Create the static body with the oriented shape
        const platform = new StaticBody(shape, material, name);
        
        // Add to level and return
        return level.addStaticBody(platform);
    }

    /**
     * Helper function to create a horizontal platform (common case)
     * @param level The Level instance to add the platform to
     * @param center Center position of the platform
     * @param width Width of the platform
     * @param depth Depth of the platform
     * @param height Optional height/thickness of the platform (defaults to 1)
     * @param material Optional material (defaults to main platform material)
     * @param name Optional name for the platform
     * @returns The created static body
     */
    private static createHorizontalPlatform(
        level: Level,
        center: THREE.Vector3,
        width: number,
        depth: number,
        height: number = 1,
        material: THREE.Material = this.MAIN_PLATFORM_MATERIAL,
        name: string = "horizontal_platform"
    ): StaticBody {
        return this.createPlatform(
            level,
            center,
            new THREE.Vector3(width, height, depth),
            material,
            name
        );
    }

    /**
     * Creates an overworld hub with portals to different levels
     * @param level The Level instance to add level elements to
     * @param game The Game instance for level switching
     */
    public static createOverworld(level: Level, game: Game): void {
        // Main platform in the center - use main material and make it larger
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-25, 0, -25),
            new THREE.Vector3(25, 2, 25),
            this.MAIN_PLATFORM_MATERIAL,
            "overworld-platform"
        ));
        
        // Regular level portals on the main platform
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 2, 0),
            new THREE.Vector3(-12, 6, 3),
            this.PORTAL_MATERIAL,
            "portal-level1"
        ));
        
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(15, 2, 0),
            new THREE.Vector3(18, 6, 3),
            this.PORTAL_MATERIAL,
            "portal-level2"
        ));
        
        // Create a separate island for the Vibeverse portal
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-5, 0, -60),
            new THREE.Vector3(15, 2, -40),
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
            new THREE.Vector3(5, 2, -25),
            this.MAIN_PLATFORM_MATERIAL,
            "vibeverse-bridge"
        ));
        
        // Add some decorative elements to the bridge
        for (let i = 0; i < 5; i++) {
            // Left side railings
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(0, 2, -39 + i * 3),
                new THREE.Vector3(0.5, 4, -38 + i * 3),
                this.PORTAL_MATERIAL,
                `bridge-rail-left-${i}`
            ));
            
            // Right side railings
            level.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(4.5, 2, -39 + i * 3),
                new THREE.Vector3(5, 4, -38 + i * 3),
                this.PORTAL_MATERIAL,
                `bridge-rail-right-${i}`
            ));
        }
        
        // Add Vibeverse portal on the separate island
        this.createVibeVersePortal(level, game);
        
        // Make action areas for regular level portals
        level.addActionArea(
            new THREE.Vector3(-13.5, 4, 1.5),    // Center of the portal
            new THREE.Vector3(6, 8, 6),          // Interaction area
            () => {
                console.log("Switching to Level 1 (Jungle Gym)");
                if (game) {
                    game.switchLevel(1);
                }
            }
        );
        
        level.addActionArea(
            new THREE.Vector3(16.5, 4, 1.5),     // Center of the portal
            new THREE.Vector3(6, 8, 6),          // Interaction area
            () => {
                console.log("Switching to Level 2 (Skydiving Challenge)");
                if (game) {
                    game.switchLevel(2);
                }
            }
        );
        
        // Add descriptive text for regular level portals
        level.levelRenderer?.addSimpleText(
            "JUNGLE GYM",
            new THREE.Vector3(-13.5, 7, 1.5),
            "white",
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "SKYDIVING",
            new THREE.Vector3(16.5, 7, 1.5),
            "white",
            "#000000"
        );
        
        // Add bridge signage
        level.levelRenderer?.addSimpleText(
            "TO VIBEVERSE",
            new THREE.Vector3(2.5, 5, -30),
            "#ffff00",
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "→",
            new THREE.Vector3(2.5, 4, -33),
            "#ffff00",
            "#000000"
        );
        
        // Main overworld text
        level.levelRenderer?.addSimpleText(
            "OVERWORLD HUB",
            new THREE.Vector3(0, 10, 0),
            "white",
            "#000000"
        );
        
        // Position player in the center of the main platform
        level.localPlayer?.setPosition(new THREE.Vector3(0, 5, 0));
        
        // Check for incoming portal traffic and position player appropriately
        this.handleIncomingPortalTraffic(level, game);
        
        console.log("Overworld hub created with portals to different levels and Vibeverse bridge");
    }
    
    /**
     * Creates a Vibeverse portal that connects to other games
     * @param level The Level instance to add the portal to
     * @param game The Game instance for handling portal interactions
     */
    private static createVibeVersePortal(level: Level, game: Game): void {
        // Create a special material for the Vibeverse portal
        const vibeverseMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,          // Cyan color
            roughness: 0.2,
            metalness: 0.9,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,   // Brighter glow
        });
        
        // Create a more dramatic portal structure on the Vibeverse island
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(3, 2, -50),
            new THREE.Vector3(7, 10, -47),
            vibeverseMaterial,
            "vibeverse-portal"
        ));
        
        // Add some decorative elements around the portal
        // Left pillar
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(1, 2, -48.5),
            new THREE.Vector3(2, 12, -47.5),
            this.PORTAL_MATERIAL,
            "vibeverse-pillar-left"
        ));
        
        // Right pillar
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(8, 2, -48.5),
            new THREE.Vector3(9, 12, -47.5),
            this.PORTAL_MATERIAL,
            "vibeverse-pillar-right"
        ));
        
        // Top arch
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(1, 11, -48.5),
            new THREE.Vector3(9, 12, -47.5),
            this.PORTAL_MATERIAL,
            "vibeverse-arch"
        ));
        
        // Add action area for the Vibeverse portal
        level.addActionArea(
            new THREE.Vector3(5, 6, -48.5),   // Center of the portal
            new THREE.Vector3(8, 10, 4),      // Large interaction area
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
                
                // Redirect to the portal
                window.location.href = portalUrl;
            }
        );
        
        // Add descriptive text and floating elements
        level.levelRenderer?.addSimpleText(
            "VIBEVERSE PORTAL",
            new THREE.Vector3(5, 13, -48.5),
            "#00ffff", // Cyan
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "CONNECT TO THE METAVERSE",
            new THREE.Vector3(5, 11.5, -48.5),
            "white",
            "#000000"
        );
        
        // Add floating arrow pointing down at the portal
        this.createFloatingArrow(level, new THREE.Vector3(5, 14, -48.5));
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
                
                // Create the return portal structure - make it slightly larger and more noticeable
                level.addStaticBody(StaticBody.createBox(
                    new THREE.Vector3(-5, 2, -10),
                    new THREE.Vector3(-1, 9, -8),  // Taller portal
                    returnPortalMaterial,
                    "return-portal"
                ));
                
                // Add action area for the return portal
                level.addActionArea(
                    new THREE.Vector3(-3, 5, -9),  // Center of the portal
                    new THREE.Vector3(8, 10, 8),   // Large interaction area
                    () => {
                        console.log("Returning to previous game");
                        
                        // Use Game's method to build the proper return URL with all parameters
                        const returnUrl = game.buildPortalReturnUrl();
                        
                        if (returnUrl) {
                            // Redirect to the return URL with all parameters
                            window.location.href = returnUrl;
                        } else {
                            console.error("Failed to build return URL");
                            // Fallback to direct referrer if URL building failed
                            window.location.href = refUrl;
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
                
                // Add multiple descriptive texts to make it very clear this is where player entered
                level.levelRenderer?.addSimpleText(
                    "RETURN PORTAL",
                    new THREE.Vector3(-3, 9.5, -9),
                    "white",
                    "#000000"
                );
                
                // Add "YOU ENTERED HERE" text
                level.levelRenderer?.addSimpleText(
                    "YOU ENTERED HERE",
                    new THREE.Vector3(-3, 8.5, -9),
                    "#ffff00", // Bright yellow
                    "#000000"
                );
                
                // Add referrer site name if available
                level.levelRenderer?.addSimpleText(
                    `BACK TO: ${displayUrl}`,
                    new THREE.Vector3(-3, 7.5, -9),
                    "#00ffff", // Cyan text
                    "#000000"
                );
                
                // Add floating arrow pointing to the portal
                this.createFloatingArrow(level, new THREE.Vector3(-3, 11, -9));
                
                // Position player in front of the return portal
                if (level.localPlayer) {
                    // Position player at a safer distance from the portal to prevent immediate activation
                    level.localPlayer.setPosition(new THREE.Vector3(-3, 5, -3));
                    
                    // Extract player information from Game's portal parameters
                    const username = game.getPortalParameter('username') || "unknown";
                    const color = game.getPortalParameter('color') || "pink";
                    const speed = game.getPortalParameter('speed') || "5";
                    const team = game.getPortalParameter('team') || "";
                    
                    // Apply customization to the player
                    level.localPlayer.setCustomization({
                        username: username,
                        color: color,
                        team: team,
                        moveSpeed: parseFloat(speed)
                    });
                    
                    console.log(`Applied portal customization to player: ${username}, ${color}, ${speed}`);
                }
                
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
            this.PORTAL_MATERIAL,
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
        const platformMaterial = this.MAIN_PLATFORM_MATERIAL;
        const obstacleMaterial = this.PORTAL_MATERIAL;

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
        // Starting platform - high up
        this.createHorizontalPlatform(
            level,
            new THREE.Vector3(0, 100, 0),    // Center position - very high up
            30,                              // Width
            30,                              // Depth
            3,                               // Height
            this.MAIN_PLATFORM_MATERIAL,
            "platform-start"
        );
        
        // First lower platform with updraft
        this.createHorizontalPlatform(
            level,
            new THREE.Vector3(40, 20, 0),    // Center position - much lower
            15,                              // Width
            15,                              // Depth
            2,                               // Height
            this.MAIN_PLATFORM_MATERIAL,
            "platform-updraft-1"
        );

        // First updraft - strong enough to boost player high
        level.addUpdraft(
            new THREE.Vector3(40, 50, 0),    // Position centered on first platform
            new THREE.Vector3(12, 60, 12),   // Size - tall enough to catch falling player
            0.15                             // Strength - stronger to lift player high
        );

        // Second lower platform with updraft
        this.createHorizontalPlatform(
            level,
            new THREE.Vector3(80, 15, 0),    // Center position - even lower
            15,                              // Width
            15,                              // Depth
            2,                               // Height
            this.MAIN_PLATFORM_MATERIAL,
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
        this.createHorizontalPlatform(
            level,
            new THREE.Vector3(180, 32, 0),   // Center position
            25,                              // Width
            25,                              // Depth
            8,                               // Height
            this.MAIN_PLATFORM_MATERIAL,
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
                game.switchLevel(0);
            },
            true  // Set triggerOnce to true
        );

        // Position player on the starting platform
        level.localPlayer?.setPosition(new THREE.Vector3(0, 104, 0));
        
        console.log("Skydiving challenge level created with updrafts and rope swing");
    }
}
