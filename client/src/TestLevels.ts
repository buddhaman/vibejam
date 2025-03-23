import * as THREE from 'three';
import { Level } from './Level';
import { StaticBody } from './StaticBody';
import { RigidBody } from './RigidBody';
import { Saw } from './Saw';

export class TestLevels {
    /**
     * Creates the Jungle Gym test level with all platforms, ropes, and obstacles
     * @param Level The Level instance to add level elements to
     */
    public static createJungleGymTest(level: Level): void {
        // Create static platforms and obstacles
        TestLevels.createStaticPlatforms(level);
        
        // Create dynamic moving platforms
        TestLevels.createDynamicPlatforms(level);
        
        // Create test ropes
        TestLevels.createRopes(level);
        
        // Create saws
        TestLevels.createSaws(level);
        
        console.log("Jungle Gym test level created with platforms, ropes, and obstacles");
    }
    
    /**
     * Create all static platforms and structures
     */
    private static createStaticPlatforms(level: Level): void {
       // Create various materials for different structures with more distinct colors
       // Use a darker reddish color for platforms that's still bright
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0xff4b81, // Brighter, more saturated pink
            roughness: 0.3,
            metalness: 0.4,
            emissive: 0xff4b81, // Same as color for a natural glow
            emissiveIntensity: 0.3 // Adjust as needed
        });
        
        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8a2be2, // Brighter purple for obstacles
            roughness: 0.5,
            metalness: 0.5
        });

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
        // Create materials for different platforms
        const redMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3366, emissive: 0xff3366, emissiveIntensity: 0.2,
            roughness: 0.4, metalness: 0.6
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
            color: 0xff33ff, emissive: 0xff33ff, emissiveIntensity: 0.3,
            roughness: 0.3, metalness: 0.7
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
        const flippingPlatform = RigidBody.createBox(
            new THREE.Vector3(0, 3.5, 8), // Position it on the positive Z side
            new THREE.Vector3(6, 2, 25), // Long but narrow platform for better flipping
            12.0,
            purpleMaterial
        );
        
        // Set fast rotation on X axis to create the flipping effect
        flippingPlatform.angularVelocity.set(FAST_ROTATION_VELOCITY, 0, 0);
        level.addDynamicBody(flippingPlatform);
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
        // Platform material with shadow support
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x3366cc,
            roughness: 0.4,
            metalness: 0.3,
            emissive: 0x3366cc,
            emissiveIntensity: 0.2,
            transparent: false,
        });
        
        // Platform 1 - Starting platform (higher up)
        const platform1 = level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 50, -15),
            new THREE.Vector3(15, 52, 15),
            platformMaterial,
            "platform-1"
        ));
        
        // Platform 2 - Distant platform (also higher up)
        const platform2 = level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(35, 45, -15),
            new THREE.Vector3(75, 47, 15),
            platformMaterial,
            "platform-2"
        ));
        
        // Add an action area on platform 2
        level.addActionArea(
            new THREE.Vector3(55, 49, 0),  // Center of platform 2, slightly above it
            new THREE.Vector3(10, 4, 10),  // Size of the trigger area
            () => {
                console.log("Congratulations! You made it to platform 2!");
            }
        );

        // Add rope for swinging between platforms
        const rope = level.addRope(
            new THREE.Vector3(20, 70, 0),  // Anchor high above middle point
            10,                           // More segments for smoother swinging
            20,                           // Long enough to reach the player
            0.2,                          // Thicker radius for better visibility
            0xffdd22                      // Yellow-orange color
        );

        level.localPlayer?.move(new THREE.Vector3(0, 52, 0));
        
        console.log("Simple test level created with swinging rope between platforms");
    }
}
