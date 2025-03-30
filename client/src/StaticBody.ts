import * as THREE from 'three';
import { ConvexShape } from '../../shared/ConvexShape';
import { Entity } from './Entity';

/**
 * Represents a static (non-moving) body in the game world
 * Static bodies form the level geometry that players can move over
 */
export class StaticBody extends Entity {
    // The convex shape used for collision detection
    shape: ConvexShape;
    
    // The visual representation
    mesh: THREE.Mesh;
    
    // Additional properties
    id: string;
    tag: string;
    
    /**
     * Create a static body
     * @param shape Convex shape for collision detection
     * @param material Material for the visual mesh
     * @param id Unique identifier (optional)
     * @param tag Classification tag (e.g., "platform", "wall")
     */
    constructor(shape: ConvexShape, material: THREE.Material, id?: string, tag: string = "platform") {
        super();
        this.shape = shape;
        this.id = id || Math.random().toString(36).substring(2, 9);
        this.tag = tag;
        
        // Create the visual mesh from the shape
        this.mesh = shape.createMesh(material);
        
        // Enable shadows on the mesh
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }
    
    /**
     * Check collision with a sphere
     * @param sphereCenter Center of the sphere
     * @param sphereRadius Radius of the sphere
     * @returns Minimum translation vector to resolve collision, or null if no collision
     */
    collideWithSphere(sphereCenter: THREE.Vector3, sphereRadius: number): THREE.Vector3 | null {
        return this.shape.collideWithSphere(sphereCenter, sphereRadius);
    }
    
    /**
     * Create a box-shaped static body
     * @param min Minimum corner of the box
     * @param max Maximum corner of the box 
     * @param material Material for the mesh
     * @param id Optional identifier
     * @param tag Classification tag
     */
    static createBox(
        min: THREE.Vector3, 
        max: THREE.Vector3, 
        material: THREE.Material,
        id?: string,
        tag: string = "platform"
    ): StaticBody {
        const shape = ConvexShape.createBox(min, max);
        return new StaticBody(shape, material, id, tag);
    }
    
    /**
     * Create a beam (elongated box) static body
     * @param start Start point of the beam
     * @param end End point of the beam
     * @param width Width of the beam
     * @param height Height of the beam
     * @param material Material for the mesh
     * @param id Optional identifier
     * @param tag Classification tag
     */
    static createBeam(
        start: THREE.Vector3,
        end: THREE.Vector3,
        width: number,
        height: number,
        material: THREE.Material,
        id?: string,
        tag: string = "platform"
    ): StaticBody {
        const shape = ConvexShape.createBeam(start, end, width, height);
        return new StaticBody(shape, material, id, tag);
    }
    
    /**
     * Create a platform at specified position
     * @param position Center position of the platform
     * @param width Width of the platform
     * @param length Length of the platform
     * @param height Height of the platform
     * @param material Material for the mesh
     * @param id Optional identifier
     */
    static createPlatform(
        position: THREE.Vector3,
        width: number,
        length: number,
        height: number,
        material: THREE.Material,
        id?: string
    ): StaticBody {
        const halfWidth = width / 2;
        const halfLength = length / 2;
        const halfHeight = height / 2;
        
        const min = new THREE.Vector3(
            position.x - halfWidth,
            position.y - halfHeight,
            position.z - halfLength
        );
        
        const max = new THREE.Vector3(
            position.x + halfWidth,
            position.y + halfHeight,
            position.z + halfLength
        );
        
        return StaticBody.createBox(min, max, material, id, "platform");
    }

    public getCollisionMesh(): THREE.Mesh {
        return this.mesh;
    }

    public getBody(): ConvexShape {
        return this.shape;
    }

    public getShape(): ConvexShape | null {
        return this.shape;
    }
}
