import * as THREE from 'three';

/**
 * MeshBuilder utility class to create various decorative and functional meshes
 */
export class MeshBuilder {
    /**
     * Creates a decorative ground mesh with embedded skull decorations
     * Uses a SINGLE mesh for the entire scene to minimize draw calls
     * @param width Width of the ground plane
     * @param depth Depth of the ground plane
     * @param skullCount Number of skulls to add to the ground
     * @returns A single combined mesh containing ground and all decorations
     */
    public static createDecorativeGround(width: number = 200, depth: number = 200, skullCount: number = 50): THREE.Mesh {
        console.log("Creating decorative ground with", skullCount, "skulls");
        
        // Step 1: Create the base ground geometry
        const geometries: THREE.BufferGeometry[] = [];
        
        // Create the ground plane
        const groundGeometry = new THREE.PlaneGeometry(width, depth, 20, 20);
        groundGeometry.rotateX(-Math.PI / 2); // Rotate to be horizontal
        
        // Add gentle terrain variation
        const groundPositions = groundGeometry.attributes.position.array;
        for (let i = 0; i < groundPositions.length; i += 3) {
            // Add gentle height variation, but keep edges flat
            const x = groundPositions[i];
            const z = groundPositions[i + 2];
            const distFromCenter = Math.sqrt(x*x + z*z) / (width/2);
            
            // Terrain gets flatter as it approaches the edges
            if (distFromCenter < 0.8) {
                const heightScale = 1.0 - distFromCenter / 0.8;
                groundPositions[i + 1] = heightScale * Math.sin(x * 0.02) * Math.cos(z * 0.02) * 3;
            }
        }
        
        // Add ground to geometries array
        geometries.push(groundGeometry);
        
        // Step 2: Create various skull and bone decorations
        console.log("Adding skulls and bone decorations");
        
        for (let i = 0; i < skullCount; i++) {
            // Choose a random decoration type
            const decorationType = Math.random();
            let decoration: THREE.BufferGeometry;
            
            // Create different decorations based on random value
            if (decorationType < 0.4) {
                // Regular box skulls - keep them as a base decoration
                decoration = this.createBoxSkull();
            } else if (decorationType < 0.7) {
                // Sphere skull with eye sockets and jaw
                decoration = this.createSphereSkull();
            } else if (decorationType < 0.85) {
                // Bone pile
                decoration = this.createBonePile();
            } else {
                // Skull on a stick
                decoration = this.createSkullOnStick();
            }
            
            // Position randomly on the ground plane
            const x = (Math.random() - 0.5) * width * 0.9;
            const z = (Math.random() - 0.5) * depth * 0.9;
            
            // Get height at this position (approximate)
            let y = 0;
            const distFromCenter = Math.sqrt(x*x + z*z) / (width/2);
            if (distFromCenter < 0.8) {
                const heightScale = 1.0 - distFromCenter / 0.8;
                y = heightScale * Math.sin(x * 0.02) * Math.cos(z * 0.02) * 3;
            }
            
            // Add a small offset to avoid z-fighting
            y += 0.1;
            
            // Create transform matrix
            const matrix = new THREE.Matrix4();
            
            // Random rotation around y-axis
            const rotationY = Math.random() * Math.PI * 2;
            matrix.makeRotationY(rotationY);
            
            // Random scale for variety
            const scale = 0.5 + Math.random() * 1.5;
            const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);
            matrix.multiply(scaleMatrix);
            
            // Set position in the matrix
            matrix.setPosition(x, y, z);
            
            // Apply the transform to the geometry
            decoration.applyMatrix4(matrix);
            
            // Add to geometries array
            geometries.push(decoration);
        }
        
        // Step 3: Merge all geometries into a single BufferGeometry
        console.log("Merging", geometries.length, "geometries");
        
        // Merge the geometries
        const mergedGeometry = this.mergeBufferGeometries(geometries);
        
        // Create a simple material for the combined mesh
        const material = new THREE.MeshStandardMaterial({
            color: 0xe0d8c0, // Bone/sandy color
            roughness: 0.75,
            metalness: 0.1,
            flatShading: true // For a more stylized look
        });
        
        // Create and return the final mesh
        const combinedMesh = new THREE.Mesh(mergedGeometry, material);
        combinedMesh.castShadow = true;
        combinedMesh.receiveShadow = true;
        combinedMesh.name = "decorativeGround";
        
        console.log("Finished creating decorative ground");
        return combinedMesh;
    }
    
    /**
     * Creates a simple box skull
     */
    private static createBoxSkull(): THREE.BufferGeometry {
        // Box for the head
        const headGeometry = new THREE.BoxGeometry(2, 2, 2);
        
        // Smaller box for the jaw
        const jawGeometry = new THREE.BoxGeometry(1.8, 0.8, 1.6);
        const jawMatrix = new THREE.Matrix4()
            .makeTranslation(0, -1.3, 0.3); // Position jaw below head
        jawGeometry.applyMatrix4(jawMatrix);
        
        // Small boxes for the eye sockets
        const eyeSocketGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        
        // Left eye
        const leftEyeMatrix = new THREE.Matrix4()
            .makeTranslation(-0.5, 0.2, 1.1); // Position left eye
        const leftEyeGeometry = eyeSocketGeometry.clone()
            .applyMatrix4(leftEyeMatrix);
        
        // Right eye
        const rightEyeMatrix = new THREE.Matrix4()
            .makeTranslation(0.5, 0.2, 1.1); // Position right eye
        const rightEyeGeometry = eyeSocketGeometry.clone()
            .applyMatrix4(rightEyeMatrix);
        
        // Create an array of geometries to merge
        const skullParts = [
            headGeometry,
            jawGeometry,
            leftEyeGeometry,
            rightEyeGeometry
        ];
        
        // Merge the skull parts into a single geometry
        return this.mergeBufferGeometries(skullParts);
    }
    
    /**
     * Creates a more rounded skull using spheres
     */
    private static createSphereSkull(): THREE.BufferGeometry {
        // Sphere for the head
        const headGeometry = new THREE.SphereGeometry(1.2, 12, 10);
        
        // Adjust the sphere to look more like a skull
        const headPositions = headGeometry.attributes.position.array;
        for (let i = 0; i < headPositions.length; i += 3) {
            const x = headPositions[i];
            const y = headPositions[i + 1];
            const z = headPositions[i + 2];
            
            // Flatten the back slightly
            if (z < -0.5) {
                headPositions[i + 2] = z * 0.8;
            }
            
            // Extend the jaw area
            if (y < -0.4 && z > 0) {
                headPositions[i + 1] = y * 1.5;
                headPositions[i + 2] = z * 1.2;
            }
        }
        headGeometry.attributes.position.needsUpdate = true;
        
        // Create eye sockets using small spheres
        const eyeSocketGeometry = new THREE.SphereGeometry(0.35, 8, 8);
        
        // Left eye
        const leftEyeMatrix = new THREE.Matrix4()
            .makeTranslation(-0.4, 0.2, 0.8); // Position left eye
        const leftEyeGeometry = eyeSocketGeometry.clone()
            .applyMatrix4(leftEyeMatrix);
        
        // Right eye
        const rightEyeMatrix = new THREE.Matrix4()
            .makeTranslation(0.4, 0.2, 0.8); // Position right eye
        const rightEyeGeometry = eyeSocketGeometry.clone()
            .applyMatrix4(rightEyeMatrix);
        
        // Create nose hole
        const noseGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const noseMatrix = new THREE.Matrix4()
            .makeTranslation(0, -0.1, 1.0); // Position nose
        noseGeometry.applyMatrix4(noseMatrix);
        
        // Create an array of geometries to merge
        const skullParts = [
            headGeometry,
            leftEyeGeometry,
            rightEyeGeometry,
            noseGeometry
        ];
        
        // Merge the skull parts into a single geometry
        return this.mergeBufferGeometries(skullParts);
    }
    
    /**
     * Creates a pile of bones
     */
    private static createBonePile(): THREE.BufferGeometry {
        const boneParts: THREE.BufferGeometry[] = [];
        
        // Base - flattened box
        const baseGeometry = new THREE.BoxGeometry(3, 0.5, 3);
        boneParts.push(baseGeometry);
        
        // Add some long bones (cylinders)
        const addBone = (x: number, y: number, z: number, length: number, rotation: THREE.Euler) => {
            const bone = new THREE.CylinderGeometry(0.2, 0.3, length, 6);
            
            // Create matrix for positioning and rotation
            const matrix = new THREE.Matrix4();
            
            // Set rotation
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(rotation);
            matrix.makeRotationFromQuaternion(quaternion);
            
            // Set position
            matrix.setPosition(x, y, z);
            
            // Apply transformation
            bone.applyMatrix4(matrix);
            
            // Add to parts
            boneParts.push(bone);
        };
        
        // Add several bones with different orientations
        addBone(0.8, 0.6, 0.3, 2.5, new THREE.Euler(0, 0, Math.PI / 4));
        addBone(-0.5, 0.5, -0.7, 2.0, new THREE.Euler(0, Math.PI / 6, -Math.PI / 3));
        addBone(0.2, 0.7, 0.8, 1.8, new THREE.Euler(Math.PI / 5, 0, Math.PI / 7));
        
        // Add a small box skull on top
        const skullGeometry = this.createBoxSkull();
        const skullMatrix = new THREE.Matrix4()
            .makeScale(0.6, 0.6, 0.6) // Make it smaller
            .setPosition(0.2, 1.0, 0.1); // Position on top of the pile
        
        skullGeometry.applyMatrix4(skullMatrix);
        boneParts.push(skullGeometry);
        
        // Merge all parts
        return this.mergeBufferGeometries(boneParts);
    }
    
    /**
     * Creates a skull on a stick
     */
    private static createSkullOnStick(): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        
        // The stick/pole
        const poleGeometry = new THREE.CylinderGeometry(0.2, 0.3, 6, 8);
        
        // Rotate to stand upright
        const poleMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
        poleGeometry.applyMatrix4(poleMatrix);
        
        // Add to parts
        parts.push(poleGeometry);
        
        // Create a sphere skull
        const skullGeometry = this.createSphereSkull();
        
        // Position on top of the pole
        const skullMatrix = new THREE.Matrix4()
            .makeTranslation(0, 0, -3) // Top of pole
            .multiply(new THREE.Matrix4().makeScale(0.8, 0.8, 0.8)); // Slightly smaller
        
        skullGeometry.applyMatrix4(skullMatrix);
        parts.push(skullGeometry);
        
        // Add some spikes around the base
        for (let i = 0; i < 4; i++) {
            // Calculate position around the circle
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.sin(angle) * 1.2;
            const y = Math.cos(angle) * 1.2;
            
            // Create a spike (cone)
            const spikeGeometry = new THREE.ConeGeometry(0.3, 1.5, 6);
            
            // Create matrix for positioning and rotation
            const rotation = new THREE.Euler(Math.PI / 2, 0, 0); // Make it horizontal
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
            
            const matrix = new THREE.Matrix4();
            matrix.makeRotationFromQuaternion(quaternion);
            
            // Rotate to point outward
            matrix.multiply(new THREE.Matrix4().makeRotationY(angle));
            
            // Position spike
            matrix.setPosition(x, y, 2.5); // Near base of pole
            
            spikeGeometry.applyMatrix4(matrix);
            parts.push(spikeGeometry);
        }
        
        // Merge all parts
        return this.mergeBufferGeometries(parts);
    }
    
    /**
     * Merge BufferGeometries into a single geometry
     */
    private static mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
        // If no geometries, return empty geometry
        if (geometries.length === 0) return new THREE.BufferGeometry();
        if (geometries.length === 1) return geometries[0];
        
        // Calculate the size of the merged buffer
        let vertexCount = 0;
        let indexCount = 0;
        let hasIndex = true;
        
        // Count total vertices and check if all geometries have indices
        for (const geo of geometries) {
            const posAttr = geo.getAttribute('position');
            vertexCount += posAttr.count;
            
            if (geo.index !== null) {
                indexCount += geo.index.count;
            } else {
                hasIndex = false;
                // If no index, we'll create triangles from the vertices (3 vertices per face)
                indexCount += posAttr.count;
            }
        }
        
        // Create the merged geometry
        const mergedGeometry = new THREE.BufferGeometry();
        
        // Create position buffer
        const positions = new Float32Array(vertexCount * 3);
        
        // Create normals buffer
        const normals = new Float32Array(vertexCount * 3);
        
        // Create UVs buffer if needed
        const uvs = new Float32Array(vertexCount * 2);
        
        // Create index buffer if all geometries are indexed
        const indices = hasIndex ? new Uint32Array(indexCount) : null;
        
        // Track offsets as we fill the buffers
        let posOffset = 0;
        let indexOffset = 0;
        let vertexOffset = 0;
        
        // Fill the buffers
        for (const geo of geometries) {
            // Get position data
            const posAttr = geo.getAttribute('position');
            const posArray = posAttr.array;
            
            // Copy positions
            positions.set(posArray, posOffset);
            posOffset += posArray.length;
            
            // Get and copy normals if available
            const normAttr = geo.getAttribute('normal');
            if (normAttr) {
                normals.set(normAttr.array, vertexOffset * 3);
            } else {
                // Compute normals if not available
                geo.computeVertexNormals();
                const computedNormAttr = geo.getAttribute('normal');
                normals.set(computedNormAttr.array, vertexOffset * 3);
            }
            
            // Get and copy UVs if available
            const uvAttr = geo.getAttribute('uv');
            if (uvAttr) {
                uvs.set(uvAttr.array, vertexOffset * 2);
            } else {
                // Create default UVs if not available
                for (let i = 0; i < posAttr.count; i++) {
                    uvs[vertexOffset * 2 + i * 2] = 0;
                    uvs[vertexOffset * 2 + i * 2 + 1] = 0;
                }
            }
            
            // Copy indices - or create them if not indexed
            if (hasIndex && indices) {
                const geoIndices = geo.index ? geo.index.array : null;
                if (geoIndices) {
                    // Adjust the indices to account for the merged vertices
                    for (let i = 0; i < geoIndices.length; i++) {
                        indices[indexOffset + i] = geoIndices[i] + vertexOffset;
                    }
                    indexOffset += geoIndices.length;
                } else {
                    // Create indices for non-indexed geometry
                    for (let i = 0; i < posAttr.count; i += 3) {
                        indices[indexOffset++] = vertexOffset + i;
                        indices[indexOffset++] = vertexOffset + i + 1;
                        indices[indexOffset++] = vertexOffset + i + 2;
                    }
                }
            }
            
            vertexOffset += posAttr.count;
        }
        
        // Set attributes on merged geometry
        mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        mergedGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        
        // Set index if all geometries were indexed
        if (hasIndex && indices) {
            mergedGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        }
        
        // Ensure normals are computed
        mergedGeometry.computeVertexNormals();
        
        return mergedGeometry;
    }
}
