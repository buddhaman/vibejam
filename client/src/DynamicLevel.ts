import { Game } from "./Game";
import { Level } from "./Level";
import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder';
import { StaticBody } from './StaticBody';
import { RigidBody } from './RigidBody';

export class DynamicLevel {
    /**
     * Creates a level with rotating platforms that move side to side
     * @param level The Level instance to add level elements to
     * @param game The Game instance for level switching
     */
    public static createRotatingPlatformsChallenge(level: Level, game: Game): void {
        // Set player start position
        level.playerStartPosition = new THREE.Vector3(0, 5, 0);
        
        // Create materials for different types of platforms
        const purpleMaterial = new THREE.MeshStandardMaterial({
            color: 0x9932cc,
            emissive: 0x9932cc,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.7
        });
        
        const blueMaterial = new THREE.MeshStandardMaterial({
            color: 0x3366ff, 
            emissive: 0x3366ff, 
            emissiveIntensity: 0.2,
            roughness: 0.4, 
            metalness: 0.6
        });
        
        const greenMaterial = new THREE.MeshStandardMaterial({
            color: 0x33ff66, 
            emissive: 0x33ff66, 
            emissiveIntensity: 0.2,
            roughness: 0.4, 
            metalness: 0.6
        });
        
        const redMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            emissive: 0xff3366,
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.6
        });
        
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Gold color for the final platform
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0xffd700,
            emissiveIntensity: 0.2
        });
        
        // Starting platform
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(0, 0, 0),    // Center position
            20,                            // Width
            20,                            // Depth
            2,                             // Height
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "platform-start"
        );
        
        // Title text
        level.levelRenderer?.addSimpleText(
            "ROTATING PLATFORMS CHALLENGE",
            new THREE.Vector3(0, 8, 0),
            "white",
            "#000000"
        );
        
        // Instructions
        level.levelRenderer?.addSimpleText(
            "CROSS THE MOVING PLATFORMS TO REACH THE FINISH",
            new THREE.Vector3(0, 6, 0),
            "#ffff00",
            "#000000"
        );
        
        // Constants for platform sizes and positions
        const PLATFORM_LENGTH = 15;
        const PLATFORM_WIDTH = 4;
        const PLATFORM_HEIGHT = 1.5;
        const PLATFORM_SPACING = 25;
        const Y_POSITION = 3; // Height of platforms
        
        // First section: Basic sine wave platforms
        let currentX = 25; // Starting position
        
        // First platform - simple side-to-side motion
        this.createSineWavePlatform(
            level,
            new THREE.Vector3(currentX, Y_POSITION, 0),
            new THREE.Vector3(PLATFORM_LENGTH, PLATFORM_HEIGHT, PLATFORM_WIDTH),
            20.0, // Mass
            purpleMaterial,
            'x', // x-axis movement
            0.05, // Speed
            'none', // No rotation
            0,
            "platform-side-to-side"
        );
        
        currentX += PLATFORM_SPACING;
        
        // Second platform - circular motion
        this.createSineWavePlatform(
            level,
            new THREE.Vector3(currentX, Y_POSITION, 0),
            new THREE.Vector3(PLATFORM_LENGTH, PLATFORM_HEIGHT, PLATFORM_WIDTH - 0.5),
            20.0,
            blueMaterial,
            'circular',
            0.04,
            'y', // y-axis rotation
            0.02,
            "platform-circular"
        );
        
        currentX += PLATFORM_SPACING;
        
        // Third platform - orbiting platform
        this.createOrbitingPlatform(
            level,
            new THREE.Vector3(currentX, Y_POSITION, 0),
            8, // Orbit radius
            new THREE.Vector3(PLATFORM_LENGTH - 4, PLATFORM_HEIGHT, PLATFORM_WIDTH - 1),
            20.0,
            greenMaterial,
            0.1, // Faster speed
            0, // No vertical offset
            "platform-orbiting"
        );
        
        currentX += PLATFORM_SPACING;
        
        // Fourth platform - patrolling between two points
        this.createPatrolPlatform(
            level,
            new THREE.Vector3(currentX - 10, Y_POSITION, -8), // Point A
            new THREE.Vector3(currentX + 10, Y_POSITION, 8),  // Point B
            new THREE.Vector3(PLATFORM_LENGTH - 6, PLATFORM_HEIGHT, PLATFORM_WIDTH - 1.5),
            20.0,
            redMaterial,
            0.08, // Speed
            true, // Add rotation
            "platform-patrol"
        );
        
        currentX += PLATFORM_SPACING;
        
        // Fifth platform - complex combined motion
        this.createMovingPlatform(
            level,
            new THREE.Vector3(currentX, Y_POSITION, 0),
            new THREE.Vector3(PLATFORM_LENGTH - 8, PLATFORM_HEIGHT, PLATFORM_WIDTH - 2),
            20.0,
            purpleMaterial,
            (time, platform) => {
                // Calculate multiple sine/cosine waves for compound motion
                const xVelocity = Math.cos(time * 1.2) * 0.06;
                const zVelocity = Math.sin(time * 0.8) * 0.08;
                
                // Small Y oscillation
                const yVelocity = Math.sin(time * 3) * 0.02;
                
                // Set combined velocity
                platform.velocity.set(xVelocity, yVelocity, zVelocity);
                
                // Set rotation that changes over time
                const rotX = Math.sin(time * 0.3) * 0.01;
                const rotY = Math.cos(time * 0.5) * 0.015;
                const rotZ = Math.sin(time * 0.7) * 0.005;
                platform.angularVelocity.set(rotX, rotY, rotZ);
            },
            "platform-complex"
        );
        
        currentX += PLATFORM_SPACING;
        
        // Create orbiting sub-platforms around a central point
        const orbitCenter = new THREE.Vector3(currentX, Y_POSITION, 0);
        
        // Central stationary platform
        LevelBuilder.createHorizontalPlatform(
            level,
            orbitCenter,
            6,   // Width
            6,   // Depth
            1,   // Height
            redMaterial,
            "orbit-center-platform"
        );
        
        // Create 3 orbiting platforms at different heights and speeds
        for (let i = 0; i < 3; i++) {
            const orbitRadius = 12;
            const verticalOffset = i * 2;
            const platformSize = new THREE.Vector3(8, PLATFORM_HEIGHT, 3);
            const orbitSpeed = 0.08 + (i * 0.02); // Increasing speeds
            
            // Alternate materials
            const material = i % 2 === 0 ? blueMaterial : greenMaterial;
            
            this.createOrbitingPlatform(
                level,
                orbitCenter,
                orbitRadius,
                platformSize,
                15.0,
                material,
                orbitSpeed,
                verticalOffset,
                `orbit-platform-${i}`
            );
        }
        
        currentX += PLATFORM_SPACING + 10;
        
        // Final platform with finish area
        const finalX = currentX;
        
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(finalX, Y_POSITION - 1, 0),
            20,                            // Width
            20,                            // Depth
            2,                             // Height
            goldMaterial,
            "platform-finish"
        );
        
        // Add a finish flag visual
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(finalX - 2, Y_POSITION + 1, 0),
            new THREE.Vector3(finalX + 2, Y_POSITION + 10, 2),
            redMaterial,
            "finish-flag-pole"
        ));
        
        // Add flag top
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(finalX + 2, Y_POSITION + 8, 0),
            new THREE.Vector3(finalX + 7, Y_POSITION + 10, 2),
            goldMaterial,
            "finish-flag"
        ));
        
        // Add text above finish area
        level.levelRenderer?.addSimpleText(
            "FINISH",
            new THREE.Vector3(finalX, Y_POSITION + 12, 0),
            "white",
            "#000000"
        );
        
        // Action area at the finish for completion
        level.addActionArea(
            new THREE.Vector3(finalX, Y_POSITION + 5, 0),  // Center of final platform
            new THREE.Vector3(15, 10, 15),                // Size of the trigger area
            () => {
                console.log("Congratulations! You completed the rotating platforms challenge!");
                level.levelRenderer?.addSimpleText(
                    "CHALLENGE COMPLETE!",
                    new THREE.Vector3(finalX, Y_POSITION + 14, 0),
                    "#ffff00",
                    "#000000"
                );
                // Switch to overworld after showing the congratulations message
                level.levelFinished();
            },
            true  // Set triggerOnce to true
        );
        
        // Portal back to overworld
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

        // Position player on the starting platform
        level.localPlayer?.setPosition(new THREE.Vector3(0, 5, 0));
        
        console.log("Rotating Platforms challenge level created with moving and rotating platforms");
    }

    /**
     * Helper function to create a moving platform with velocity-based movement
     * @param level The Level instance to add the platform to
     * @param center Initial center position of the platform
     * @param dimensions Dimensions of the platform (width, height, depth)
     * @param mass Mass of the platform
     * @param material Material for the platform
     * @param velocityUpdateFn Function to update velocity and angularVelocity
     * @param name Optional name for the platform
     * @returns The created RigidBody platform
     */
    public static createMovingPlatform(
        level: Level,
        center: THREE.Vector3,
        dimensions: THREE.Vector3,
        mass: number,
        material: THREE.Material,
        velocityUpdateFn: (time: number, body: RigidBody) => void,
        name: string = "moving-platform"
    ): RigidBody {
        // Create platform as a RigidBody
        const platform = RigidBody.createBox(
            center,
            dimensions,
            mass,
            material
        );
        
        // Set the custom update function
        platform.customUpdate = (time: number, self: RigidBody) => {
            // Call the provided velocity update function
            velocityUpdateFn(time, self);
        };
        
        // Add the platform to the level
        level.addDynamicBody(platform);
        
        // Return the platform for further modification if needed
        return platform;
    }

    /**
     * Creates a sine wave oscillating platform using velocity
     * @param level The Level instance to add the platform to
     * @param center Initial center position of the platform
     * @param dimensions Dimensions of the platform (width, height, depth)
     * @param mass Mass of the platform
     * @param material Material for the platform
     * @param moveAxis Axis to oscillate along ('x', 'y', 'z', or 'circular')
     * @param speed Speed factor of the movement
     * @param rotationAxis Axis to rotate around ('x', 'y', 'z', 'none')
     * @param rotationSpeed Speed of rotation
     * @param name Optional name for the platform
     * @returns The created RigidBody platform
     */
    public static createSineWavePlatform(
        level: Level,
        center: THREE.Vector3,
        dimensions: THREE.Vector3,
        mass: number,
        material: THREE.Material,
        moveAxis: 'x' | 'y' | 'z' | 'circular',
        speed: number = 0.05,
        rotationAxis: 'x' | 'y' | 'z' | 'none' = 'none',
        rotationSpeed: number = 0.02,
        name: string = "sine-wave-platform"
    ): RigidBody {
        // Store the initial position and bounds for oscillation
        const initialPosition = center.clone();
        
        // Create the velocity update function
        const velocityUpdate = (time: number, platform: RigidBody) => {
            // Calculate sine and cosine values based on time
            const sineValue = Math.sin(time * 2);
            const cosineValue = Math.cos(time * 2);
            
            // Calculate target velocity based on sine function and desired movement axis
            switch (moveAxis) {
                case 'x':
                    // Calculate target velocity based on current position relative to origin
                    // This creates a smooth oscillation by adjusting velocity
                    const targetVelX = sineValue * speed;
                    platform.velocity.x = targetVelX;
                    // Zero out other velocity components
                    platform.velocity.y = 0;
                    platform.velocity.z = 0;
                    break;
                case 'y':
                    const targetVelY = sineValue * speed;
                    platform.velocity.y = targetVelY;
                    platform.velocity.x = 0;
                    platform.velocity.z = 0;
                    break;
                case 'z':
                    const targetVelZ = sineValue * speed;
                    platform.velocity.z = targetVelZ;
                    platform.velocity.x = 0;
                    platform.velocity.y = 0;
                    break;
                case 'circular':
                    // For circular motion, use both sine and cosine
                    // This creates circular motion by combining x and z velocity
                    platform.velocity.x = cosineValue * speed;
                    platform.velocity.z = sineValue * speed;
                    platform.velocity.y = 0;
                    break;
            }
            
            // Apply rotation based on selected axis
            switch (rotationAxis) {
                case 'x':
                    platform.angularVelocity.set(rotationSpeed, 0, 0);
                    break;
                case 'y':
                    platform.angularVelocity.set(0, rotationSpeed, 0);
                    break;
                case 'z':
                    platform.angularVelocity.set(0, 0, rotationSpeed);
                    break;
                case 'none':
                    platform.angularVelocity.set(0, 0, 0);
                    break;
            }
            
            // Optional: prevent platform from drifting too far from its initial position
            const distanceFromOrigin = platform.shape.position.distanceTo(initialPosition);
            if (distanceFromOrigin > 15) {
                // If drifted too far, add a correction velocity to return towards initial position
                const correctionDirection = initialPosition.clone().sub(platform.shape.position).normalize();
                const correctionSpeed = 0.1;
                platform.velocity.add(correctionDirection.multiplyScalar(correctionSpeed));
            }
        };
        
        // Create the platform using the generic createMovingPlatform method
        return this.createMovingPlatform(
            level,
            center,
            dimensions,
            mass,
            material,
            velocityUpdate,
            name
        );
    }

    /**
     * Creates a platform that moves between two points
     * @param level The Level instance to add the platform to
     * @param pointA First endpoint of movement
     * @param pointB Second endpoint of movement
     * @param dimensions Dimensions of the platform (width, height, depth)
     * @param mass Mass of the platform
     * @param material Material for the platform
     * @param speed Speed of movement between points
     * @param rotate Whether to rotate the platform
     * @param name Optional name for the platform
     * @returns The created RigidBody platform
     */
    public static createPatrolPlatform(
        level: Level,
        pointA: THREE.Vector3,
        pointB: THREE.Vector3,
        dimensions: THREE.Vector3,
        mass: number,
        material: THREE.Material,
        speed: number = 0.05,
        rotate: boolean = false,
        name: string = "patrol-platform"
    ): RigidBody {
        // Calculate direction vector between points
        const direction = pointB.clone().sub(pointA).normalize();
        const distance = pointA.distanceTo(pointB);
        
        // Create velocity update function
        const velocityUpdate = (time: number, platform: RigidBody) => {
            // Calculate the platform's current projected distance along the path
            const currentVec = platform.shape.position.clone().sub(pointA);
            const projectedDistance = currentVec.dot(direction);
            
            // Determine if we're heading toward pointA or pointB
            const goingToB = Math.sin(time * 0.5) > 0;
            
            // Calculate target velocity based on where we are and where we're going
            let targetVelocity: THREE.Vector3;
            
            if (goingToB) {
                // Going toward pointB
                targetVelocity = direction.clone().multiplyScalar(speed);
            } else {
                // Going toward pointA
                targetVelocity = direction.clone().multiplyScalar(-speed);
            }
            
            // Set platform velocity
            platform.velocity.copy(targetVelocity);
            
            // Add rotation if requested
            if (rotate) {
                // Rotate around axis perpendicular to movement direction
                const rotationAxis = new THREE.Vector3(1, 1, 1).cross(direction).normalize();
                const rotationSpeed = 0.02;
                
                platform.angularVelocity.copy(rotationAxis.multiplyScalar(rotationSpeed));
            }
            
            // Add boundaries to prevent drifting past the endpoints
            if (projectedDistance < 0) {
                // If beyond pointA, push back toward the path
                platform.velocity.add(direction.clone().multiplyScalar(0.1));
            } else if (projectedDistance > distance) {
                // If beyond pointB, push back toward the path
                platform.velocity.add(direction.clone().multiplyScalar(-0.1));
            }
        };
        
        // Create the platform at the first point
        return this.createMovingPlatform(
            level,
            pointA.clone(),
            dimensions,
            mass,
            material,
            velocityUpdate,
            name
        );
    }

    /**
     * Creates a platform that orbits around a central point
     * @param level The Level instance to add the platform to
     * @param center Center point of the orbit
     * @param radius Radius of the orbit
     * @param dimensions Dimensions of the platform (width, height, depth)
     * @param mass Mass of the platform
     * @param material Material for the platform
     * @param speed Orbital speed
     * @param verticalOffset Vertical offset from the center point
     * @param name Optional name for the platform
     * @returns The created RigidBody platform
     */
    public static createOrbitingPlatform(
        level: Level,
        center: THREE.Vector3,
        radius: number,
        dimensions: THREE.Vector3,
        mass: number,
        material: THREE.Material,
        speed: number = 0.05,
        verticalOffset: number = 0,
        name: string = "orbiting-platform"
    ): RigidBody {
        // Calculate initial position on the orbit
        const initialPosition = center.clone().add(new THREE.Vector3(radius, verticalOffset, 0));
        
        // Create velocity update function
        const velocityUpdate = (time: number, platform: RigidBody) => {
            // Calculate current position relative to center
            const relativePos = platform.shape.position.clone().sub(center);
            relativePos.y = 0; // Keep orbital motion in the XZ plane
            
            // Calculate current angle and radius
            const currentRadius = relativePos.length();
            const currentAngle = Math.atan2(relativePos.z, relativePos.x);
            
            // Calculate target angular velocity
            const angularVelocity = speed;
            
            // Calculate target velocity for circular motion
            // v = r * ω * (-sin(θ), 0, cos(θ))
            const tangentialDir = new THREE.Vector3(
                -Math.sin(currentAngle),
                0,
                Math.cos(currentAngle)
            );
            
            // Set velocity to be tangential to the circle
            platform.velocity.copy(tangentialDir.multiplyScalar(speed));
            
            // Add radial correction to maintain the desired radius
            const radialDir = relativePos.clone().normalize();
            const radialCorrection = (radius - currentRadius) * 0.1;
            platform.velocity.add(radialDir.multiplyScalar(radialCorrection));
            
            // Keep platform at consistent height
            platform.velocity.y = 0;
            platform.shape.position.y = center.y + verticalOffset;
            
            // Make platform face the direction of travel
            platform.angularVelocity.set(0, angularVelocity * 0.5, 0);
        };
        
        // Create the platform at the initial position
        return this.createMovingPlatform(
            level,
            initialPosition,
            dimensions,
            mass,
            material,
            velocityUpdate,
            name
        );
    }

    /**
     * Creates a simple challenge level with three patrol platforms
     * @param level The Level instance to add level elements to
     * @param game The Game instance for level switching
     */
    public static createSimplePatrolChallenge(level: Level, game: Game): void {
        // Set player start position
        level.playerStartPosition = new THREE.Vector3(0, 5, 0);
        
        // Create materials for the platforms
        const platformMaterial1 = new THREE.MeshStandardMaterial({
            color: 0x3366ff, // Blue
            emissive: 0x3366ff,
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.6
        });
        
        const platformMaterial2 = new THREE.MeshStandardMaterial({
            color: 0xff3366, // Red
            emissive: 0xff3366,
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.6
        });
        
        const platformMaterial3 = new THREE.MeshStandardMaterial({
            color: 0x33ff66, // Green
            emissive: 0x33ff66,
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.6
        });
        
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Gold
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0xffd700,
            emissiveIntensity: 0.2
        });
        
        // Starting platform
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(0, 0, 0),    // Center position
            20,                            // Width
            20,                            // Depth
            2,                             // Height
            LevelBuilder.MAIN_PLATFORM_MATERIAL,
            "platform-start"
        );
        
        // Title text
        level.levelRenderer?.addSimpleText(
            "PATROL PLATFORMS CHALLENGE",
            new THREE.Vector3(0, 8, 0),
            "white",
            "#000000"
        );
        
        // Instructions
        level.levelRenderer?.addSimpleText(
            "CROSS THE MOVING PLATFORMS TO REACH THE FINISH",
            new THREE.Vector3(0, 6, 0),
            "#ffff00",
            "#000000"
        );
        
        // Constants
        const Y_POSITION = 3; // Height of platforms
        const PLATFORM_LENGTH = 12;
        const PLATFORM_WIDTH = 5;
        const PLATFORM_HEIGHT = 1;
        
        // First platform - horizontal patrol (left to right)
        this.createPatrolPlatform(
            level,
            new THREE.Vector3(25, Y_POSITION, 0),      // Left endpoint
            new THREE.Vector3(45, Y_POSITION, 0),      // Right endpoint
            new THREE.Vector3(PLATFORM_LENGTH, PLATFORM_HEIGHT, PLATFORM_WIDTH),
            20.0, // Mass
            platformMaterial1,
            0.06, // Speed
            false, // No rotation
            "platform-patrol-1"
        );
        
        // Second platform - vertical patrol (forward/backward)
        this.createPatrolPlatform(
            level,
            new THREE.Vector3(60, Y_POSITION, -10),    // Back endpoint
            new THREE.Vector3(60, Y_POSITION, 10),     // Front endpoint
            new THREE.Vector3(PLATFORM_LENGTH, PLATFORM_HEIGHT, PLATFORM_WIDTH),
            20.0,
            platformMaterial2,
            0.05, // Slightly slower
            false,
            "platform-patrol-2"
        );
        
        // Third platform - diagonal patrol
        this.createPatrolPlatform(
            level,
            new THREE.Vector3(75, Y_POSITION, -10),    // Back-left endpoint
            new THREE.Vector3(95, Y_POSITION, 10),     // Front-right endpoint
            new THREE.Vector3(PLATFORM_LENGTH, PLATFORM_HEIGHT, PLATFORM_WIDTH),
            20.0,
            platformMaterial3,
            0.07, // Slightly faster
            false,
            "platform-patrol-3"
        );
        
        // Final platform
        const finalX = 110;
        
        LevelBuilder.createHorizontalPlatform(
            level,
            new THREE.Vector3(finalX, Y_POSITION - 1, 0),
            20,                            // Width
            20,                            // Depth
            2,                             // Height
            goldMaterial,
            "platform-finish"
        );
        
        // Add a finish flag
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(finalX - 2, Y_POSITION + 1, 0),
            new THREE.Vector3(finalX + 2, Y_POSITION + 10, 2),
            platformMaterial2, // Red flag pole
            "finish-flag-pole"
        ));
        
        // Add flag top
        level.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(finalX + 2, Y_POSITION + 8, 0),
            new THREE.Vector3(finalX + 7, Y_POSITION + 10, 2),
            goldMaterial,
            "finish-flag"
        ));
        
        // Add text above finish area
        level.levelRenderer?.addSimpleText(
            "FINISH",
            new THREE.Vector3(finalX, Y_POSITION + 12, 0),
            "white",
            "#000000"
        );
        
        // Action area at the finish for completion
        level.addActionArea(
            new THREE.Vector3(finalX, Y_POSITION + 5, 0),  // Center of final platform
            new THREE.Vector3(15, 10, 15),                // Size of the trigger area
            () => {
                console.log("Congratulations! You completed the patrol platforms challenge!");
                level.levelRenderer?.addSimpleText(
                    "CHALLENGE COMPLETE!",
                    new THREE.Vector3(finalX, Y_POSITION + 14, 0),
                    "#ffff00",
                    "#000000"
                );
                // Switch to overworld after showing the congratulations message
                level.levelFinished();
            },
            true  // Set triggerOnce to true
        );
        
        // Portal back to overworld
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

        // Position player on the starting platform
        level.localPlayer?.setPosition(new THREE.Vector3(0, 5, 0));
        
        console.log("Simple Patrol Platforms challenge level created");
    }
}