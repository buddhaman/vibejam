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