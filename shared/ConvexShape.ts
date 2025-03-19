import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Represents a 3D convex shape with efficient collision detection
 */
export class ConvexShape {
    // Points defining the convex shape
    points: THREE.Vector3[];
    
    // Faces of the convex shape (each face is a polygon defined by point indices)
    faces: { indices: number[] }[];
    
    // Cached data for performance
    boundingSphere: { center: THREE.Vector3, radius: number };
    
    /**
     * Create a convex shape from points and faces
     * @param points Array of points defining the convex shape
     * @param faces Array of faces, each defined by indices into the points array
     */
    constructor(points: THREE.Vector3[], faces?: { indices: number[] }[]) {
        this.points = points;
        
        // If faces are not provided, we assume it's a simple shape
        // and faces will be computed during collision detection
        this.faces = faces || [];
        
        // Calculate bounding sphere
        this.boundingSphere = this.calculateBoundingSphere();
    }
    
    /**
     * Calculate a bounding sphere for quick rejection tests
     */
    private calculateBoundingSphere(): { center: THREE.Vector3, radius: number } {
        // Find centroid
        const center = new THREE.Vector3();
        for (const point of this.points) {
            center.add(point);
        }
        center.divideScalar(this.points.length);
        
        // Find radius (maximum distance from centroid to any point)
        let maxDistSq = 0;
        for (const point of this.points) {
            const distSq = center.distanceToSquared(point);
            if (distSq > maxDistSq) {
                maxDistSq = distSq;
            }
        }
        
        return {
            center,
            radius: Math.sqrt(maxDistSq)
        };
    }
    
    /**
     * Check collision with a sphere and return the minimum translation vector
     * @param sphereCenter The center of the sphere
     * @param sphereRadius The radius of the sphere
     * @returns Minimum translation vector to resolve collision, or null if no collision
     */
    collideWithSphere(sphereCenter: THREE.Vector3, sphereRadius: number): THREE.Vector3 | null {
        // Quick rejection with bounding sphere
        const centerDist = this.boundingSphere.center.distanceTo(sphereCenter);
        if (centerDist > this.boundingSphere.radius + sphereRadius) {
            return null; // No collision possible
        }
        
        // Special handling for when faces are defined
        if (this.faces.length > 0) {
            // Check if sphere is inside the shape by testing all faces
            let isInside = true;
            let minPenetration = Number.MAX_VALUE;
            let minNormal = new THREE.Vector3();
            
            // Test each face
            for (const face of this.faces) {
                const facePoints = face.indices.map(idx => this.points[idx]);
                const normal = this.calculateFaceNormal(facePoints);
                const point = this.points[face.indices[0]];
                
                // Calculate distance from sphere center to face plane
                const distToPlane = normal.dot(new THREE.Vector3().subVectors(sphereCenter, point));
                
                // If sphere is in front of any face, it's not fully inside
                if (distToPlane > -sphereRadius) {
                    isInside = false;
                }
                
                // Calculate penetration
                const penetration = sphereRadius + distToPlane;
                
                // If sphere overlaps with this face plane, track minimum penetration
                if (penetration > 0 && penetration < minPenetration) {
                    minPenetration = penetration;
                    minNormal.copy(normal);
                }
            }
            
            // If sphere is fully inside, push it out via the face with minimum penetration
            if (isInside) {
                return minNormal.multiplyScalar(-minPenetration);
            }
            
            // If sphere is outside but penetrating through a face, handle that case
            if (minPenetration < Number.MAX_VALUE) {
                // Verify that this is actually a collision by checking closest point
                const closestPoint = this.findClosestPoint(sphereCenter);
                const distanceToClosest = sphereCenter.distanceTo(closestPoint);
                
                if (distanceToClosest <= sphereRadius) {
                    // Return minimum penetration vector along face normal
                    return minNormal.multiplyScalar(-minPenetration);
                }
            }
        }
        
        // Standard closest point approach for cases without faces
        // or when the sphere is not fully inside or clearly penetrating a face
        const closestPoint = this.findClosestPoint(sphereCenter);
        const distanceToClosest = sphereCenter.distanceTo(closestPoint);
        
        if (distanceToClosest > sphereRadius) {
            return null; // No collision
        }
        
        // Calculate penetration vector
        const penetrationDepth = sphereRadius - distanceToClosest;
        const direction = new THREE.Vector3().subVectors(sphereCenter, closestPoint);
        
        // Handle case where closest point is exactly at sphere center
        if (direction.lengthSq() < 0.0001) {
            // Use direction from shape's center to sphere center
            direction.subVectors(sphereCenter, this.boundingSphere.center);
            
            // If still too small, use arbitrary direction
            if (direction.lengthSq() < 0.0001) {
                direction.set(0, 1, 0);
            }
        }
        
        // Normalize and scale by penetration depth
        direction.normalize().multiplyScalar(penetrationDepth);
        
        return direction;
    }
    
    /**
     * Find the closest point on the convex shape to a given point
     * @param point The point to find the closest point to
     * @returns The closest point on the convex shape
     */
    findClosestPoint(point: THREE.Vector3): THREE.Vector3 {
        // If we have faces defined, use them for a more precise calculation
        if (this.faces.length > 0) {
            return this.findClosestPointUsingFaces(point);
        }
        
        // Fallback to simplex-based approach
        return this.findClosestPointSimplex(point);
    }
    
    /**
     * Find closest point using face information
     */
    private findClosestPointUsingFaces(point: THREE.Vector3): THREE.Vector3 {
        let closestPoint = new THREE.Vector3();
        let minDistSq = Number.MAX_VALUE;
        
        // Check each face
        for (const face of this.faces) {
            const facePoints = face.indices.map(idx => this.points[idx]);
            
            // Find closest point on this face
            const faceClosest = this.projectPointOnFace(point, facePoints);
            const distSq = point.distanceToSquared(faceClosest);
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestPoint.copy(faceClosest);
            }
        }
        
        // Check each edge
        for (const face of this.faces) {
            const indices = face.indices;
            for (let i = 0; i < indices.length; i++) {
                const p1 = this.points[indices[i]];
                const p2 = this.points[indices[(i + 1) % indices.length]];
                
                const edgeClosest = this.closestPointOnLine(point, p1, p2);
                const distSq = point.distanceToSquared(edgeClosest);
                
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closestPoint.copy(edgeClosest);
                }
            }
        }
        
        // Check each vertex
        for (const p of this.points) {
            const distSq = point.distanceToSquared(p);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestPoint.copy(p);
            }
        }
        
        return closestPoint;
    }
    
    /**
     * Find closest point using a simplified approach
     * Good for simple convex shapes without face information
     */
    private findClosestPointSimplex(point: THREE.Vector3): THREE.Vector3 {
        // For simple cases, just check all points
        if (this.points.length <= 8) {
            let closestPoint = this.points[0];
            let minDistSq = point.distanceToSquared(closestPoint);
            
            for (let i = 1; i < this.points.length; i++) {
                const distSq = point.distanceToSquared(this.points[i]);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closestPoint = this.points[i];
                }
            }
            
            // Check all edges
            for (let i = 0; i < this.points.length; i++) {
                for (let j = i + 1; j < this.points.length; j++) {
                    const edgeClosest = this.closestPointOnLine(
                        point, this.points[i], this.points[j]
                    );
                    
                    const distSq = point.distanceToSquared(edgeClosest);
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        closestPoint = edgeClosest;
                    }
                }
            }
            
            return closestPoint;
        }
        
        // For more complex shapes, use a simple hill-climbing algorithm
        // Start with centroid
        let current = this.boundingSphere.center.clone();
        let currentDistSq = point.distanceToSquared(current);
        let improved = true;
        
        while (improved) {
            improved = false;
            
            // Try to move toward each point
            for (const p of this.points) {
                const testPoint = new THREE.Vector3().addVectors(current, p).multiplyScalar(0.5);
                const testDistSq = point.distanceToSquared(testPoint);
                
                if (testDistSq < currentDistSq) {
                    current = testPoint;
                    currentDistSq = testDistSq;
                    improved = true;
                    break;
                }
            }
        }
        
        return current;
    }
    
    /**
     * Project a point onto a face (polygon)
     */
    private projectPointOnFace(point: THREE.Vector3, facePoints: THREE.Vector3[]): THREE.Vector3 {
        // Calculate face normal
        const normal = this.calculateFaceNormal(facePoints);
        
        // Project point onto face plane
        const v0 = facePoints[0];
        const dist = normal.dot(new THREE.Vector3().subVectors(point, v0));
        
        // Projected point
        const projected = new THREE.Vector3().copy(point).sub(normal.clone().multiplyScalar(dist));
        
        // Check if projected point is inside the face
        if (this.isPointInFace(projected, facePoints, normal)) {
            return projected;
        }
        
        // If not inside, find closest edge or vertex
        let minDistSq = Number.MAX_VALUE;
        let closest = new THREE.Vector3();
        
        // Check edges
        for (let i = 0; i < facePoints.length; i++) {
            const p1 = facePoints[i];
            const p2 = facePoints[(i + 1) % facePoints.length];
            
            const edgeClosest = this.closestPointOnLine(point, p1, p2);
            const distSq = point.distanceToSquared(edgeClosest);
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest.copy(edgeClosest);
            }
        }
        
        return closest;
    }
    
    /**
     * Calculate normal of a face
     */
    private calculateFaceNormal(facePoints: THREE.Vector3[]): THREE.Vector3 {
        // Use first three points to calculate normal
        const v0 = facePoints[0];
        const v1 = facePoints[1];
        const v2 = facePoints[2];
        
        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        
        return new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    }
    
    /**
     * Check if a point is inside a face
     */
    private isPointInFace(point: THREE.Vector3, facePoints: THREE.Vector3[], normal: THREE.Vector3): boolean {
        // Very simple test for convex polygons:
        // Point is inside if all cross products point in same direction as normal
        
        for (let i = 0; i < facePoints.length; i++) {
            const p1 = facePoints[i];
            const p2 = facePoints[(i + 1) % facePoints.length];
            
            const edge = new THREE.Vector3().subVectors(p2, p1);
            const toPoint = new THREE.Vector3().subVectors(point, p1);
            
            const cross = new THREE.Vector3().crossVectors(edge, toPoint);
            
            if (cross.dot(normal) < 0) {
                return false; // Point is outside
            }
        }
        
        return true; // Point is inside
    }
    
    /**
     * Find closest point on a line segment
     */
    private closestPointOnLine(point: THREE.Vector3, lineStart: THREE.Vector3, lineEnd: THREE.Vector3): THREE.Vector3 {
        const line = new THREE.Vector3().subVectors(lineEnd, lineStart);
        const lineLength = line.length();
        
        // Handle degenerate line
        if (lineLength < 0.0001) {
            return lineStart.clone();
        }
        
        const lineDir = line.clone().divideScalar(lineLength);
        
        const pointVector = new THREE.Vector3().subVectors(point, lineStart);
        let projection = pointVector.dot(lineDir);
        
        // Clamp to line segment
        projection = Math.max(0, Math.min(lineLength, projection));
        
        return new THREE.Vector3().copy(lineStart).addScaledVector(lineDir, projection);
    }
    
    /**
     * Create a mesh for visualization
     */
    createMesh(material: THREE.Material): THREE.Mesh {
        // If we have faces defined, use them to create the mesh
        if (this.faces.length > 0) {
            return this.createMeshFromFaces(material);
        }
        
        // Without faces, create a simple convex hull by computing faces
        // First create temporary faces by triangulating the convex hull
        const tempFaces: { indices: number[] }[] = [];
        
        // Simple approach: create triangles from first point to all other point pairs
        if (this.points.length >= 3) {
            for (let i = 1; i < this.points.length - 1; i++) {
                tempFaces.push({ indices: [0, i, i + 1] });
            }
            
            // Use our existing method with these temporary faces
            this.faces = tempFaces;
            const mesh = this.createMeshFromFaces(material);
            // Restore original faces
            this.faces = [];
            return mesh;
        }
        
        // Fallback for too few points
        const geometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (const point of this.points) {
            positions.push(point.x, point.y, point.z);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        return new THREE.Mesh(geometry, material);
    }
    
    /**
     * Create mesh using predefined faces
     */
    private createMeshFromFaces(material: THREE.Material): THREE.Mesh {
        // When converting to a mesh, we need to flip the winding order for rendering
        // compared to what we use for collision detection
        
        const geometry = new THREE.BufferGeometry();
        
        // Add all points
        const positions: number[] = [];
        for (const point of this.points) {
            positions.push(point.x, point.y, point.z);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // For rendering with outward normals, we need to reverse the winding order
        // from what's used in the collision detection
        const indices: number[] = [];
        for (const face of this.faces) {
            // Triangulate face (assumes convex face)
            for (let i = 1; i < face.indices.length - 1; i++) {
                // The order matters - this creates outward-facing normals for rendering
                indices.push(
                    face.indices[0],    // Keep first vertex as pivot
                    face.indices[i+1],   // order for rendering,
                    face.indices[i],    // Reverse these two to flip the winding
                );
            }
        }
        
        geometry.setIndex(indices);
        
        // For flat shading, convert to non-indexed
        const flatGeometry = toCreasedNormals(geometry, Math.PI / 2);
        
        // Enable flat shading on the material
        if (material instanceof THREE.MeshStandardMaterial || 
            material instanceof THREE.MeshPhongMaterial ||
            material instanceof THREE.MeshLambertMaterial) {
            material.flatShading = true;
            material.needsUpdate = true;
        }
        
        return new THREE.Mesh(flatGeometry, material);
    }
    
    /**
     * Create a box shape
     */
    static createBox(min: THREE.Vector3, max: THREE.Vector3): ConvexShape {
        // Define the 8 corners of the box
        const points = [
            new THREE.Vector3(min.x, min.y, min.z), // 0: xyz
            new THREE.Vector3(max.x, min.y, min.z), // 1: Xyz
            new THREE.Vector3(max.x, min.y, max.z), // 2: XyZ
            new THREE.Vector3(min.x, min.y, max.z), // 3: xyZ
            new THREE.Vector3(min.x, max.y, min.z), // 4: xYz
            new THREE.Vector3(max.x, max.y, min.z), // 5: XYz
            new THREE.Vector3(max.x, max.y, max.z), // 6: XYZ
            new THREE.Vector3(min.x, max.y, max.z)  // 7: xYZ
        ];
        
        // Define the 6 faces of the box
        const faces = [
            { indices: [0, 3, 2, 1] }, // Bottom
            { indices: [4, 5, 6, 7] }, // Top
            { indices: [0, 1, 5, 4] }, // Front
            { indices: [2, 3, 7, 6] }, // Back
            { indices: [0, 4, 7, 3] }, // Left
            { indices: [1, 2, 6, 5] }  // Right
        ];
        
        return new ConvexShape(points, faces);
    }
    
    /**
     * Create a beam (box with one dimension much larger than others)
     */
    static createBeam(start: THREE.Vector3, end: THREE.Vector3, width: number, height: number): ConvexShape {
        // Calculate beam direction and length
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const length = start.distanceTo(end);
        
        // Create orthogonal axes
        const up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(direction.dot(up)) > 0.999) {
            up.set(1, 0, 0); // Use X-axis if beam is along Y-axis
        }
        
        const right = new THREE.Vector3().crossVectors(direction, up).normalize().multiplyScalar(width / 2);
        up.crossVectors(right, direction).normalize().multiplyScalar(height / 2);
        
        // Create the 8 corners of the beam
        const points = [
            // Start face
            new THREE.Vector3().copy(start).sub(right).sub(up),
            new THREE.Vector3().copy(start).add(right).sub(up),
            new THREE.Vector3().copy(start).add(right).add(up),
            new THREE.Vector3().copy(start).sub(right).add(up),
            
            // End face
            new THREE.Vector3().copy(end).sub(right).sub(up),
            new THREE.Vector3().copy(end).add(right).sub(up),
            new THREE.Vector3().copy(end).add(right).add(up),
            new THREE.Vector3().copy(end).sub(right).add(up)
        ];
        
        // Define the 6 faces
        const faces = [
            { indices: [0, 1, 2, 3] }, // Start face
            { indices: [4, 7, 6, 5] }, // End face
            { indices: [0, 3, 7, 4] }, // Left face
            { indices: [1, 5, 6, 2] }, // Right face
            { indices: [0, 4, 5, 1] }, // Bottom face
            { indices: [3, 2, 6, 7] }  // Top face
        ];
        
        return new ConvexShape(points, faces);
    }
} 