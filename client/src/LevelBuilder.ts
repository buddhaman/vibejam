import * as THREE from 'three';
import { Level } from './Level';
import { StaticBody } from './StaticBody';
import { ConvexShape } from '../../shared/ConvexShape';

export class LevelBuilder {
    // Global materials that match our pink theme
    public static readonly MAIN_PLATFORM_MATERIAL = new THREE.MeshStandardMaterial({
        color: 0xff3366,          // Vibrant pink-red
        roughness: 0.4,
        metalness: 0.3,
        emissive: 0xff3366,
        emissiveIntensity: 0.2,
    });

    public static readonly PORTAL_MATERIAL = new THREE.MeshStandardMaterial({
        color: 0x9932cc,          // Dark orchid purple
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x9932cc,
        emissiveIntensity: 0.6
    });

    // Instance state
    private level: Level;
    private position: THREE.Vector3;
    private direction: number; // Angle in radians (y-rotation)
    private directionVector: THREE.Vector3 = new THREE.Vector3(1, 0, 0);

    /**
     * Create a new LevelBuilder for the given level
     * @param level The level to build on
     * @param startPosition Optional starting position (default: origin)
     * @param startDirection Optional starting direction in radians (default: 0 = positive X axis)
     */
    constructor(level: Level, startPosition?: THREE.Vector3, startDirection: number = 0) {
        this.level = level;
        this.position = startPosition ? startPosition.clone() : new THREE.Vector3(0, 0, 0);
        this.direction = startDirection;
        this.updateDirectionVector();
    }

    /**
     * Update the internal direction vector based on the current angle
     */
    private updateDirectionVector(): void {
        this.directionVector = new THREE.Vector3(
            Math.cos(this.direction),
            0,
            Math.sin(this.direction)
        ).normalize();
    }

    /**
     * Get the current position
     */
    getPosition(): THREE.Vector3 {
        return this.position.clone();
    }

    /**
     * Get the current direction vector
     */
    getDirectionVector(): THREE.Vector3 {
        return this.directionVector.clone();
    }

    /**
     * Get the current direction angle
     */
    getDirection(): number {
        return this.direction;
    }

    /**
     * Set a new absolute position
     * @param position The new position
     * @returns This builder for chaining
     */
    setPosition(position: THREE.Vector3): LevelBuilder {
        this.position.copy(position);
        return this;
    }

    /**
     * Move relative to the current position
     * @param offset The offset to move by
     * @returns This builder for chaining
     */
    move(offset: THREE.Vector3): LevelBuilder {
        this.position.add(offset);
        return this;
    }

    /**
     * Move forward in the current direction
     * @param distance Distance to move forward
     * @returns This builder for chaining
     */
    moveForward(distance: number): LevelBuilder {
        const offset = this.directionVector.clone().multiplyScalar(distance);
        this.position.add(offset);
        return this;
    }

    moveDown(distance: number): LevelBuilder {
        this.position.y -= distance;
        return this;
    }

    /**
     * Move right perpendicular to the current direction
     * @param distance Distance to move right
     * @returns This builder for chaining
     */
    moveRight(distance: number): LevelBuilder {
        const rightVector = new THREE.Vector3(
            Math.cos(this.direction + Math.PI/2),
            0,
            Math.sin(this.direction + Math.PI/2)
        );
        const offset = rightVector.multiplyScalar(distance);
        this.position.add(offset);
        return this;
    }

    /**
     * Move up relative to the current position
     * @param distance Distance to move up
     * @returns This builder for chaining
     */
    moveUp(distance: number): LevelBuilder {
        this.position.y += distance;
        return this;
    }

    /**
     * Set the absolute direction angle
     * @param angle Direction angle in radians
     * @returns This builder for chaining
     */
    setDirection(angle: number): LevelBuilder {
        this.direction = angle;
        this.updateDirectionVector();
        return this;
    }

    /**
     * Turn relative to the current direction
     * @param angle Angle to turn in radians
     * @returns This builder for chaining
     */
    turn(angle: number): LevelBuilder {
        this.direction += angle;
        this.updateDirectionVector();
        return this;
    }

    /**
     * Create a platform at the current position aligned with the current direction
     * @param width Width of the platform
     * @param height Height/thickness of the platform
     * @param depth Depth of the platform
     * @param material Optional material
     * @param name Optional name
     * @returns The created static body
     */
    createPlatformHere(
        width: number, 
        height: number, 
        depth: number,
        material: THREE.Material = LevelBuilder.MAIN_PLATFORM_MATERIAL,
        name: string = "platform"
    ): StaticBody {
        // Create a box shape centered at origin
        const halfSize = new THREE.Vector3(width/2, height/2, depth/2);
        const min = new THREE.Vector3(-halfSize.x, -halfSize.y, -halfSize.z);
        const max = new THREE.Vector3(halfSize.x, halfSize.y, halfSize.z);
        
        // Create the shape with proper orientation
        const shape = ConvexShape.createBox(min, max);
        const rotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), this.direction
        );
        shape.orientation.copy(rotation);
        shape.setPosition(this.position);
        shape.updateTransform();
        
        // Create the static body with the oriented shape
        const platform = new StaticBody(shape, material, name);
        
        // Add to level and return
        return this.level.addStaticBody(platform);
    }

    /**
     * Create a platform ahead of the current position, then move to it
     * @param distance Distance to place the platform ahead
     * @param width Width of the platform
     * @param height Height/thickness of the platform
     * @param depth Depth of the platform
     * @param material Optional material
     * @param name Optional name
     * @returns The created static body
     */
    createPlatformAhead(
        distance: number,
        width: number, 
        height: number, 
        depth: number,
        material: THREE.Material = LevelBuilder.MAIN_PLATFORM_MATERIAL,
        name: string = "platform_ahead"
    ): StaticBody {
        // Save current position
        const oldPosition = this.position.clone();
        
        // Move ahead
        this.moveForward(distance);
        
        // Create platform
        const platform = this.createPlatformHere(width, height, depth, material, name);
        
        // Return to original position
        this.position.copy(oldPosition);
        
        return platform;
    }

    /**
     * Add a rope at the current position
     * @param height Height above current position
     * @param segments Number of rope segments
     * @param length Length of the rope
     * @param radius Radius of the rope
     * @param color Color of the rope
     * @returns The builder for chaining
     */
    addRopeHere(
        height: number,
        segments: number,
        length: number,
        radius: number = 0.2,
        color: number = 0x22ff22
    ): LevelBuilder {
        const ropePosition = this.position.clone().add(new THREE.Vector3(0, height, 0));
        this.level.addRope(ropePosition, segments, length, radius, color);
        return this;
    }

    /**
     * Add a portal at the current position facing the current direction
     * @param width Width of the portal
     * @param height Height of the portal
     * @param material Optional material
     * @param name Optional name
     * @param callback Callback function when portal is activated
     * @returns The builder for chaining
     */
    addPortalHere(
        width: number,
        height: number,
        material: THREE.Material = LevelBuilder.PORTAL_MATERIAL,
        name: string = "portal",
        callback?: () => void
    ): LevelBuilder {
        // Create a portal box
        const halfWidth = width / 2;
        const halfDepth = 1; // Portal depth
        
        // Create box aligned with direction
        const portalMin = new THREE.Vector3(-halfWidth, 0, -halfDepth);
        const portalMax = new THREE.Vector3(halfWidth, height, halfDepth);
        
        // Create the shape with proper orientation
        const shape = ConvexShape.createBox(portalMin, portalMax);
        const rotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), this.direction
        );
        shape.orientation.copy(rotation);
        shape.setPosition(this.position);
        shape.updateTransform();
        
        
        // Add action area if callback provided
        if (callback) {
            // Action area in front of portal
            const actionAreaPosition = this.position.clone().add(
                this.directionVector.clone().multiplyScalar(2)
            );
            actionAreaPosition.y+=6;
            this.level.addActionArea(
                actionAreaPosition,
                new THREE.Vector3(width + 2, height + 2, 4),
                callback
            );
        }
        
        return this;
    }

    /**
     * Add text at the current position
     * @param text Text to display
     * @param height Height above current position
     * @param color Optional text color
     * @param backgroundColor Optional background color
     * @returns The builder for chaining
     */
    addTextHere(
        text: string,
        height: number,
        color: string = "white",
        backgroundColor: string = "#000000"
    ): LevelBuilder {
        const textPosition = this.position.clone().add(new THREE.Vector3(0, height, 0));
        this.level.levelRenderer?.addSimpleText(text, textPosition, color, backgroundColor);
        return this;
    }

    // Static methods for backwards compatibility
    /**
     * Helper function to create a platform using center position and size
     * @param level The Level instance to add the platform to
     * @param center Center position of the platform
     * @param size Size of the platform (width, height, depth)
     * @param material Optional material (defaults to main platform material)
     * @param name Optional name for the platform
     * @returns The created static body
     */
    public static createPlatform(
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
    public static createOrientedPlatform(
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
    public static createHorizontalPlatform(
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
}