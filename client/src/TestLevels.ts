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
        // Main platform in the center - use main material
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 0, -15),
            new THREE.Vector3(15, 2, 15),
            this.MAIN_PLATFORM_MATERIAL,
            "overworld-platform"
        ));
        
        // Both portals now use the same purple material
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-10, 2, 0),
            new THREE.Vector3(-8, 6, 2),
            this.PORTAL_MATERIAL,
            "portal-level0"
        ));
        
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(8, 2, 0),
            new THREE.Vector3(10, 6, 2),
            this.PORTAL_MATERIAL,
            "portal-level1"
        ));
        
        // Make action areas bigger (doubled size)
        level.addActionArea(
            new THREE.Vector3(-9, 4, 1),    // Center of the portal
            new THREE.Vector3(6, 8, 6),     // Doubled size from 3,4,3 to 6,8,6
            () => {
                console.log("Switching to Level 0 (Jungle Gym)");
                if (game) {
                    game.switchLevel(0);
                }
            }
        );
        
        level.addActionArea(
            new THREE.Vector3(9, 4, 1),     // Center of the portal
            new THREE.Vector3(6, 8, 6),     // Doubled size
            () => {
                console.log("Switching to Level 1 (Simple Test)");
                if (game) {
                    game.switchLevel(1);
                }
            }
        );
        
        // Add descriptive text
        level.levelRenderer?.addSimpleText(
            "JUNGLE GYM",
            new THREE.Vector3(-9, 7, 1),
            "white",
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "SWING & UPDRAFT",
            new THREE.Vector3(9, 7, 1),
            "white",
            "#000000"
        );
        
        level.levelRenderer?.addSimpleText(
            "OVERWORLD HUB",
            new THREE.Vector3(0, 10, 0),
            "white",
            "#000000"
        );
        
        // Position player in the center of the overworld
        level.localPlayer?.setPosition(new THREE.Vector3(0, 5, 0));
        
        console.log("Overworld hub created with portals to different levels");
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
                    game.switchLevel(2);  // 2 represents the overworld
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
    public static createSimpleTestLevel(level: Level): void {
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
            new THREE.Vector3(180, 35, 0),   // Center position
            25,                              // Width
            25,                              // Depth
            3,                               // Height
            this.MAIN_PLATFORM_MATERIAL,
            "platform-final"
        );
        
        // Action area on final platform
        level.addActionArea(
            new THREE.Vector3(160, 44, 0),   // Center of final platform, slightly above
            new THREE.Vector3(10, 4, 10),    // Size of the trigger area
            () => {
                console.log("Congratulations! You completed the skydiving challenge!");
                level.levelRenderer?.addSimpleText(
                    "Congratulations! You completed the skydiving challenge!",
                    new THREE.Vector3(160, 44, 0),
                    "white",
                    "black"
                );
            },
            true  // Set triggerOnce to true
        );

        // Position player on the starting platform
        level.localPlayer?.setPosition(new THREE.Vector3(0, 104, 0));
        
        console.log("Skydiving challenge level created with updrafts and rope swing");
    }
}
