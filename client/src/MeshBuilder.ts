import * as THREE from 'three';

/**
 * MeshBuilder utility class to create various decorative and functional meshes
 */
export class MeshBuilder {
    // Static cache for expensive meshes
    private static cachedMeshes: Map<string, THREE.Mesh> = new Map();
    
    /**
     * Creates a decorative ground mesh with embedded skull decorations
     * Uses a SINGLE mesh for the entire scene to minimize draw calls
     * The mesh is cached and reused if called multiple times with the same parameters
     * @param width Width of the ground plane
     * @param depth Depth of the ground plane
     * @param skullCount Number of skulls to add to the ground
     * @param terrainHeight Maximum height variation for the terrain (default: 3)
     * @param rubbleCount Number of rubble piles to create (default: 30)
     * @param boneStackCount Number of bone stacks to create (default: 25)
     * @param skullOnStickCount Number of skulls on sticks to create (default: 15)
     * @param crossCount Number of crosses to create (default: 100)
     * @returns A single combined mesh containing ground and all decorations
     */
    public static createDecorativeGround(
        width: number = 300, 
        depth: number = 300, 
        skullCount: number = 300,
        terrainHeight: number = 3,
        rubbleCount: number = 500,
        boneStackCount: number = 250,
        skullOnStickCount: number = 200,
        crossCount: number = 100
    ): THREE.Mesh {
        // Create a cache key based on the parameters
        const cacheKey = `ground_${width}_${depth}_${skullCount}_${terrainHeight}_${rubbleCount}_${boneStackCount}_${skullOnStickCount}_${crossCount}`;
        
        // Check if this mesh is already cached
        if (this.cachedMeshes.has(cacheKey)) {
            console.log("Returning cached decorative ground");
            // Return a clone of the cached mesh to ensure independent transforms
            const cachedMesh = this.cachedMeshes.get(cacheKey)!;
            return cachedMesh.clone();
        }
        
        console.log("Creating decorative ground with", skullCount, "skulls,", 
            rubbleCount, "rubble piles,", boneStackCount, "bone stacks, and", 
            skullOnStickCount, "skulls on sticks");
        
        // Calculate total decorations
        const totalDecorations = skullCount + rubbleCount + boneStackCount + skullOnStickCount + crossCount;
        
        // Step 1: Create the base ground geometry
        const geometries: THREE.BufferGeometry[] = [];
        
        // Create higher resolution ground for more detail
        const groundGeometry = new THREE.PlaneGeometry(width, depth, 40, 40);
        groundGeometry.rotateX(-Math.PI / 2); // Make sure to rotate the plane to be horizontal
        
        // Use multiple noise functions at different frequencies for more natural terrain
        const groundPositions = groundGeometry.attributes.position.array;
        for (let i = 0; i < groundPositions.length; i += 3) {
            const x = groundPositions[i];
            const z = groundPositions[i + 2];
            const distFromCenter = Math.sqrt(x*x + z*z) / (width/2);
            
            // Terrain gets completely flat at the edges
            if (distFromCenter < 0.9) {
                // Use user-defined maximum height
                const heightScale = Math.max(0, 1.0 - distFromCenter / 0.9);
                
                // Multiple noise functions at different frequencies
                const noise1 = Math.sin(x * 0.01) * Math.cos(z * 0.01);
                const noise2 = Math.sin(x * 0.03 + z * 0.02) * 0.3;
                const noise3 = Math.cos(x * 0.02 - z * 0.01) * 0.2;
                
                // Add more variation with craters
                const crater1X = width * 0.2;
                const crater1Z = depth * -0.15;
                const distFromCrater1 = Math.sqrt(Math.pow(x - crater1X, 2) + Math.pow(z - crater1Z, 2));
                const crater1 = distFromCrater1 < 15 ? -2 * Math.exp(-distFromCrater1 * 0.1) : 0;
                
                const crater2X = width * -0.25;
                const crater2Z = depth * 0.3;
                const distFromCrater2 = Math.sqrt(Math.pow(x - crater2X, 2) + Math.pow(z - crater2Z, 2));
                const crater2 = distFromCrater2 < 20 ? -2.5 * Math.exp(-distFromCrater2 * 0.08) : 0;
                
                // Apply height with scale factor
                groundPositions[i + 1] = heightScale * (noise1 + noise2 + noise3 + crater1 + crater2) * terrainHeight;
            } else {
                // Ensure the edges are completely flat
                groundPositions[i + 1] = 0;
            }
        }
        
        // Add vertex colors to ground
        const groundVertexCount = groundGeometry.attributes.position.count;
        const groundColors = new Float32Array(groundVertexCount * 3);
        
        // Create varied colors for the ground
        for (let i = 0; i < groundVertexCount; i++) {
            const x = groundPositions[i * 3];
            const y = groundPositions[i * 3 + 1];
            const z = groundPositions[i * 3 + 2];
            
            // Base sandy color
            let r = 0.88;
            let g = 0.82;
            let b = 0.67;
            
            // Add variation based on position
            r += Math.sin(x * 0.05) * 0.1;
            g += Math.cos(z * 0.05) * 0.1;
            b += Math.sin(x * 0.02 + z * 0.02) * 0.05;
            
            // Darken in depressions
            if (y < 0) {
                r *= (1 + y * 0.05);
                g *= (1 + y * 0.05);
                b *= (1 + y * 0.02);
            }
            
            // Store colors
            groundColors[i * 3] = r;
            groundColors[i * 3 + 1] = g;
            groundColors[i * 3 + 2] = b;
        }
        
        groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
        
        // Add ground to geometries array
        geometries.push(groundGeometry);
        
        // Step 2: Create various skull and bone decorations
        console.log("Adding decorations");
        
        // Track how many of each type we've created
        let rubbleCreated = 0;
        let boneStackCreated = 0;
        let skullOnStickCreated = 0; 
        let bonePileCreated = 0;
        let regularSkullCreated = 0;
        let crossesCreated = 0;
        
        // Calculate bone pile count as a portion of skull count
        const bonePileCount = Math.floor(skullCount * 0.35);
        
        // Create all decorations in a single loop
        for (let i = 0; i < totalDecorations; i++) {
            // Position randomly across the entire terrain with uniform distribution
            const x = (Math.random() * 2 - 1) * width * 0.45;  // Uniform distribution across X
            const z = (Math.random() * 2 - 1) * depth * 0.45;  // Uniform distribution across Z
            
            // Get height at this position (approximate)
            let y = 0;
            const distFromCenter = Math.sqrt(x*x + z*z) / (width/2);
            if (distFromCenter < 0.9) {
                // Multiple noise functions to match ground generation
                const noise1 = Math.sin(x * 0.01) * Math.cos(z * 0.01);
                const noise2 = Math.sin(x * 0.03 + z * 0.02) * 0.3;
                const noise3 = Math.cos(x * 0.02 - z * 0.01) * 0.2;
                
                // Add crater effects
                const crater1X = width * 0.2;
                const crater1Z = depth * -0.15;
                const distFromCrater1 = Math.sqrt(Math.pow(x - crater1X, 2) + Math.pow(z - crater1Z, 2));
                const crater1 = distFromCrater1 < 15 ? -2 * Math.exp(-distFromCrater1 * 0.1) : 0;
                
                const crater2X = width * -0.25;
                const crater2Z = depth * 0.3;
                const distFromCrater2 = Math.sqrt(Math.pow(x - crater2X, 2) + Math.pow(z - crater2Z, 2));
                const crater2 = distFromCrater2 < 20 ? -2.5 * Math.exp(-distFromCrater2 * 0.08) : 0;
                
                // Apply height calculation matching the ground generation
                const heightScale = Math.max(0, 1.0 - distFromCenter / 0.9);
                y = heightScale * (noise1 + noise2 + noise3 + crater1 + crater2) * terrainHeight;
            }
            
            // Add a small offset to avoid z-fighting
            y += 0.1;
            
            // Determine decoration type based on its position in the sequence
            let decoration: THREE.BufferGeometry;
            
            if (i < rubbleCount) {
                // Create rubble with stone-like colors
                const rubbleHue = 0.06 + Math.random() * 0.04;
                const rubbleSat = 0.15 + Math.random() * 0.2;
                const rubbleLight = 0.4 + Math.random() * 0.2;
                
                const rubbleColor = new THREE.Color().setHSL(rubbleHue, rubbleSat, rubbleLight);
                decoration = this.createRubble(rubbleColor);
                rubbleCreated++;
            }
            else if (i < rubbleCount + boneStackCount) {
                // Create bone stack
                const stackHue = 0.06 + Math.random() * 0.03;
                const stackSat = 0.05 + Math.random() * 0.1;
                const stackLight = 0.8 + Math.random() * 0.15;
                
                const stackColor = new THREE.Color().setHSL(stackHue, stackSat, stackLight);
                decoration = this.createBoneStack(stackColor);
                boneStackCreated++;
            }
            else if (i < rubbleCount + boneStackCount + skullOnStickCount) {
                // Create skull on stick
                const skullHue = 0.08 + Math.random() * 0.03; // Skull color
                const skullSat = 0.05 + Math.random() * 0.1;
                const skullLight = 0.7 + Math.random() * 0.2;
                
                const stickHue = 0.07 + Math.random() * 0.05; // Wooden stick color (browner)
                const stickSat = 0.4 + Math.random() * 0.2;
                const stickLight = 0.3 + Math.random() * 0.2;
                
                const skullColor = new THREE.Color().setHSL(skullHue, skullSat, skullLight);
                const stickColor = new THREE.Color().setHSL(stickHue, stickSat, stickLight);
                
                decoration = this.createSkullOnStick(skullColor, stickColor);
                skullOnStickCreated++;
            }
            else if (i < rubbleCount + boneStackCount + skullOnStickCount + crossCount) {
                // Create cross with skull
                const crossHue = 0.07 + Math.random() * 0.04; // Wooden cross color
                const crossSat = 0.3 + Math.random() * 0.2;
                const crossLight = 0.3 + Math.random() * 0.2;
                
                const skullHue = 0.08 + Math.random() * 0.03; // Skull color
                const skullSat = 0.1 + Math.random() * 0.1;
                const skullLight = 0.7 + Math.random() * 0.2;
                
                const crossColor = new THREE.Color().setHSL(crossHue, crossSat, crossLight);
                const skullColor = new THREE.Color().setHSL(skullHue, skullSat, skullLight);
                
                decoration = this.createCrossWithSkull(crossColor, skullColor);
                
                // Track for logging
                crossesCreated++;
            }
            else if (i < rubbleCount + boneStackCount + skullOnStickCount + crossCount + bonePileCount) {
                // Create bone pile
                const hue = 0.07 + Math.random() * 0.05; // Yellow to brown hue range
                const sat = 0.15 + Math.random() * 0.15; // Medium saturation
                const light = 0.6 + Math.random() * 0.2; // Less bright
                
                const color = new THREE.Color().setHSL(hue, sat, light);
                decoration = this.createBonePile(color);
                bonePileCreated++;
            }
            else {
                // Create regular skulls with the remaining slots
                // Alternate between box and sphere skulls
                if (i % 2 === 0) {
                    const hue = 0.08 + Math.random() * 0.03; // Slight yellow-brown hue
                    const sat = 0.1 + Math.random() * 0.1;   // Low saturation
                    const light = 0.75 + Math.random() * 0.2; // Fairly bright
                    
                    const color = new THREE.Color().setHSL(hue, sat, light);
                    decoration = this.createBoxSkull(color);
                } else {
                    const hue = 0.05 + Math.random() * 0.04; // More yellow-white hue
                    const sat = 0.05 + Math.random() * 0.1;  // Very low saturation
                    const light = 0.8 + Math.random() * 0.15; // Brighter
                    
                    const color = new THREE.Color().setHSL(hue, sat, light);
                    decoration = this.createSphereSkull(color);
                }
                regularSkullCreated++;
            }
            
            // Create transform matrix
            const matrix = new THREE.Matrix4();
            
            // Random rotation around y-axis
            const rotationY = Math.random() * Math.PI * 2;
            matrix.makeRotationY(rotationY);
            
            // Random scale for variety, but slightly smaller on average
            const scale = 0.4 + Math.random() * 1.3;
            const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);
            matrix.multiply(scaleMatrix);
            
            // Set position in the matrix
            matrix.setPosition(x, y, z);
            
            // Apply the transform to the geometry
            decoration.applyMatrix4(matrix);
            
            // Add to geometries array
            geometries.push(decoration);
        }
        
        console.log("Created:", 
            rubbleCreated, "rubble piles,", 
            boneStackCreated, "bone stacks,",
            skullOnStickCreated, "skulls on sticks,",
            crossesCreated, "crosses with skulls,",
            bonePileCreated, "bone piles, and",
            regularSkullCreated, "regular skulls"
        );
        
        // Step 3: Merge all geometries into a single BufferGeometry
        console.log("Merging", geometries.length, "geometries");
        
        // Merge the geometries
        const mergedGeometry = this.mergeBufferGeometries(geometries);
        
        // Create a material that uses vertex colors
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,  // Enable vertex colors
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
        
        // Cache the mesh
        this.cachedMeshes.set(cacheKey, combinedMesh);
        
        return combinedMesh;
    }
    
    /**
     * Get the default decorative ground without rebuilding
     * This provides global access to the same mesh instance
     */
    public static getDefaultDecorativeGround(): THREE.Mesh {
        // Use default parameters
        return this.createDecorativeGround();
    }
    
    /**
     * Clear any cached meshes to free memory
     */
    public static clearCache(): void {
        this.cachedMeshes.clear();
        console.log("Mesh builder cache cleared");
    }
    
    /**
     * Creates a simple box skull
     * @param color Base color for the skull
     */
    private static createBoxSkull(color: THREE.Color = new THREE.Color(0.9, 0.85, 0.75)): THREE.BufferGeometry {
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
        
        // Add colors to each part - make jaw slightly darker than head
        const headColor = color.clone();
        const jawColor = color.clone().multiplyScalar(0.95); // Slightly darker
        const eyeColor = new THREE.Color(0.1, 0.1, 0.1); // Dark eye sockets
        
        this.addVertexColors(headGeometry, headColor);
        this.addVertexColors(jawGeometry, jawColor);
        this.addVertexColors(leftEyeGeometry, eyeColor);
        this.addVertexColors(rightEyeGeometry, eyeColor);
        
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
     * @param color Base color for the skull
     */
    private static createSphereSkull(color: THREE.Color = new THREE.Color(0.95, 0.9, 0.8)): THREE.BufferGeometry {
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
        
        // Add colors - dark for eye sockets and nose, bone color for skull
        const darkColor = new THREE.Color(0.1, 0.1, 0.1);
        
        this.addVertexColors(headGeometry, color, 0.05); // More variation in skull
        this.addVertexColors(leftEyeGeometry, darkColor);
        this.addVertexColors(rightEyeGeometry, darkColor);
        this.addVertexColors(noseGeometry, darkColor);
        
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
     * @param color Base color for the bone pile
     */
    private static createBonePile(color: THREE.Color = new THREE.Color(0.85, 0.8, 0.7)): THREE.BufferGeometry {
        const boneParts: THREE.BufferGeometry[] = [];
        
        // Base - flattened box
        const baseGeometry = new THREE.BoxGeometry(3, 0.5, 3);
        
        // Darker color for the base
        const baseColor = color.clone().multiplyScalar(0.8);
        this.addVertexColors(baseGeometry, baseColor, 0.1); // Darker, dirty base
        boneParts.push(baseGeometry);
        
        // Add some long bones (cylinders)
        const addBone = (x: number, y: number, z: number, length: number, rotation: THREE.Euler, age: number = 0) => {
            const bone = new THREE.CylinderGeometry(0.2, 0.3, length, 6);
            
            // Bone color based on age (0=fresh, 1=ancient)
            const boneColor = color.clone();
            
            // Age affects the color - older bones are darker and more yellowed
            if (age > 0) {
                boneColor.multiplyScalar(1.0 - age * 0.2);
                // Add yellow/brown tint to aged bones
                boneColor.r += age * 0.1;
                boneColor.g -= age * 0.05;
                boneColor.b -= age * 0.15;
            }
            
            this.addVertexColors(bone, boneColor, 0.1);
            
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
        addBone(0.8, 0.6, 0.3, 2.5, new THREE.Euler(0, 0, Math.PI / 4), 0.2);
        addBone(-0.5, 0.5, -0.7, 2.0, new THREE.Euler(0, Math.PI / 6, -Math.PI / 3), 0.5);
        addBone(0.2, 0.7, 0.8, 1.8, new THREE.Euler(Math.PI / 5, 0, Math.PI / 7), 0.8);
        
        // Add a small box skull on top with color slightly brighter than the base
        const skullColor = color.clone().multiplyScalar(1.1);
        const skullGeometry = this.createBoxSkull(skullColor);
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
     * @param skullColor Color for the skull
     * @param stickColor Color for the stick and spikes
     */
    private static createSkullOnStick(
        skullColor: THREE.Color = new THREE.Color(0.95, 0.9, 0.8),
        stickColor: THREE.Color = new THREE.Color(0.6, 0.4, 0.3)
    ): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        
        // The stick/pole
        const poleGeometry = new THREE.CylinderGeometry(0.2, 0.3, 6, 8);
        this.addVertexColors(poleGeometry, stickColor, 0.15); // Wood with grain variation
        
        // No need to rotate - Y is already up for cylinder geometry
        
        // Add to parts
        parts.push(poleGeometry);
        
        // Create a sphere skull
        const skullGeometry = this.createSphereSkull(skullColor);
        
        // Position on top of the pole
        const skullMatrix = new THREE.Matrix4()
            .makeTranslation(0, 3, 0) // Top of pole (Y is up)
            .multiply(new THREE.Matrix4().makeScale(0.8, 0.8, 0.8)); // Slightly smaller
        
        skullGeometry.applyMatrix4(skullMatrix);
        parts.push(skullGeometry);
        
        // Add some spikes around the base
        for (let i = 0; i < 4; i++) {
            // Calculate position around the circle
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.sin(angle) * 1.2;
            const z = Math.cos(angle) * 1.2;
            
            // Create a spike (cone)
            const spikeGeometry = new THREE.ConeGeometry(0.3, 1.5, 6);
            
            // Slightly darker than the stick
            const spikeColor = stickColor.clone().multiplyScalar(0.8);
            this.addVertexColors(spikeGeometry, spikeColor, 0.05);
            
            // Create matrix for positioning and rotation
            const matrix = new THREE.Matrix4();
            
            // Rotate to point outward horizontally (Z rotation to make spike point outward)
            const rotation = new THREE.Euler(0, 0, Math.PI / 2);
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
            matrix.makeRotationFromQuaternion(quaternion);
            
            // Rotate around Y axis to position around the pole
            matrix.multiply(new THREE.Matrix4().makeRotationY(angle));
            
            // Position spike
            matrix.setPosition(x, -2.5, z); // Near base of pole (Y is up)
            
            spikeGeometry.applyMatrix4(matrix);
            parts.push(spikeGeometry);
        }
        
        // Merge all parts
        return this.mergeBufferGeometries(parts);
    }
    
    /**
     * Helper method to add vertex colors to a geometry
     * @param geometry The geometry to color
     * @param color The base color
     * @param variation Amount of random variation (0-1)
     */
    private static addVertexColors(
        geometry: THREE.BufferGeometry, 
        color: THREE.Color,
        variation: number = 0.02
    ): void {
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            // Create a copy of the color for this vertex
            const vertexColor = color.clone();
            
            // Add slight random variation
            vertexColor.r += (Math.random() - 0.5) * variation;
            vertexColor.g += (Math.random() - 0.5) * variation;
            vertexColor.b += (Math.random() - 0.5) * variation;
            
            // Clamp to valid RGB range
            vertexColor.r = Math.max(0, Math.min(1, vertexColor.r));
            vertexColor.g = Math.max(0, Math.min(1, vertexColor.g));
            vertexColor.b = Math.max(0, Math.min(1, vertexColor.b));
            
            // Store the rgb values
            colors[i * 3] = vertexColor.r;
            colors[i * 3 + 1] = vertexColor.g;
            colors[i * 3 + 2] = vertexColor.b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
        let hasColors = false;
        
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
            
            // Check if any geometry has colors
            if (geo.getAttribute('color')) {
                hasColors = true;
            }
        }
        
        // Create the merged geometry
        const mergedGeometry = new THREE.BufferGeometry();
        
        // Create position buffer
        const positions = new Float32Array(vertexCount * 3);
        
        // Create normals buffer
        const normals = new Float32Array(vertexCount * 3);
        
        // Create colors buffer if any geometry has colors
        const colors = hasColors ? new Float32Array(vertexCount * 3) : null;
        
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
            
            // Get and copy colors if available
            if (colors) {
                const colorAttr = geo.getAttribute('color');
                if (colorAttr) {
                    colors.set(colorAttr.array, vertexOffset * 3);
                } else {
                    // If this geometry doesn't have colors but others do, 
                    // add white as a fallback (shouldn't happen with our setup)
                    for (let i = 0; i < posAttr.count; i++) {
                        colors[vertexOffset * 3 + i * 3] = 1;
                        colors[vertexOffset * 3 + i * 3 + 1] = 1;
                        colors[vertexOffset * 3 + i * 3 + 2] = 1;
                    }
                }
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
        
        // Set color attribute if colors exist
        if (colors) {
            mergedGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        
        // Set index if all geometries were indexed
        if (hasIndex && indices) {
            mergedGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        }
        
        // Ensure normals are computed
        mergedGeometry.computeVertexNormals();
        
        return mergedGeometry;
    }

    /**
     * Creates a pile of rubble/debris
     * @param color Base color for the rubble
     */
    private static createRubble(color: THREE.Color = new THREE.Color(0.6, 0.5, 0.4)): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        
        // Create base
        const baseGeometry = new THREE.BoxGeometry(3, 0.4, 3);
        this.addVertexColors(baseGeometry, color.clone().multiplyScalar(0.7));
        parts.push(baseGeometry);
        
        // Add 8-12 rock pieces
        const rockCount = 8 + Math.floor(Math.random() * 5);
        
        for (let i = 0; i < rockCount; i++) {
            // Random rock size and shape
            const width = 0.3 + Math.random() * 0.8;
            const height = 0.2 + Math.random() * 0.4;
            const depth = 0.3 + Math.random() * 0.6;
            
            const rockGeometry = new THREE.BoxGeometry(width, height, depth);
            
            // Slightly vary rock color
            const rockColor = color.clone();
            rockColor.r += (Math.random() - 0.5) * 0.15;
            rockColor.g += (Math.random() - 0.5) * 0.15;
            rockColor.b += (Math.random() - 0.5) * 0.1;
            
            this.addVertexColors(rockGeometry, rockColor, 0.1);
            
            // Random position on base
            const x = (Math.random() - 0.5) * 2;
            const y = height/2 + 0.2 + Math.random() * 0.4;
            const z = (Math.random() - 0.5) * 2;
            
            // Random rotation
            const matrix = new THREE.Matrix4()
                .makeRotationX(Math.random() * Math.PI)
                .multiply(new THREE.Matrix4().makeRotationY(Math.random() * Math.PI))
                .multiply(new THREE.Matrix4().makeRotationZ(Math.random() * Math.PI))
                .setPosition(x, y, z);
            
            rockGeometry.applyMatrix4(matrix);
            parts.push(rockGeometry);
        }
        
        return this.mergeBufferGeometries(parts);
    }

    /**
     * Creates a neatly arranged stack of bones
     * @param color Base color for the bone stack
     */
    private static createBoneStack(color: THREE.Color = new THREE.Color(0.92, 0.88, 0.82)): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(3.5, 0.2, 2);
        this.addVertexColors(baseGeometry, color.clone().multiplyScalar(0.7), 0.05);
        parts.push(baseGeometry);
        
        // Create neat stacks of long bones
        const createBoneLayer = (y: number, horizontal: boolean, layerColor: THREE.Color) => {
            const count = horizontal ? 4 : 2;
            
            for (let i = 0; i < count; i++) {
                const bone = new THREE.CylinderGeometry(0.15, 0.2, horizontal ? 3 : 2, 6);
                this.addVertexColors(bone, layerColor, 0.05);
                
                let x = 0, z = 0;
                if (horizontal) {
                    z = -0.7 + i * 0.5;
                } else {
                    x = -0.6 + i * 1.2;
                }
                
                const rotation = new THREE.Euler(
                    horizontal ? Math.PI/2 : 0,
                    0,
                    horizontal ? 0 : Math.PI/2
                );
                
                const matrix = new THREE.Matrix4();
                const quat = new THREE.Quaternion().setFromEuler(rotation);
                matrix.makeRotationFromQuaternion(quat);
                matrix.setPosition(x, y, z);
                
                bone.applyMatrix4(matrix);
                parts.push(bone);
            }
        };
        
        // Create alternating layers
        createBoneLayer(0.3, true, color.clone()); // First layer (horizontal)
        createBoneLayer(0.7, false, color.clone().multiplyScalar(0.95)); // Second layer (vertical)
        createBoneLayer(1.1, true, color.clone().multiplyScalar(0.9)); // Third layer (horizontal)
        
        // Add a small skull on top
        const skullGeometry = this.createBoxSkull(color.clone().multiplyScalar(1.05));
        const skullMatrix = new THREE.Matrix4()
            .makeScale(0.4, 0.4, 0.4)
            .setPosition(0.8, 1.3, 0);
        
        skullGeometry.applyMatrix4(skullMatrix);
        parts.push(skullGeometry);
        
        return this.mergeBufferGeometries(parts);
    }

    /**
     * Creates a cross with a skull at its base
     * @param crossColor Color for the cross
     * @param skullColor Color for the skull
     */
    private static createCrossWithSkull(
        crossColor: THREE.Color = new THREE.Color(0.6, 0.4, 0.3),
        skullColor: THREE.Color = new THREE.Color(0.85, 0.8, 0.7)
    ): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        
        // Vertical pole of the cross
        const poleGeometry = new THREE.BoxGeometry(0.4, 4.5, 0.4);
        this.addVertexColors(poleGeometry, crossColor, 0.1);
        parts.push(poleGeometry);
        
        // Horizontal crossbar
        const crossbarGeometry = new THREE.BoxGeometry(2.0, 0.4, 0.4);
        const crossbarMatrix = new THREE.Matrix4()
            .setPosition(0, 1.0, 0); // Position crossbar near the top
        crossbarGeometry.applyMatrix4(crossbarMatrix);
        this.addVertexColors(crossbarGeometry, crossColor, 0.1);
        parts.push(crossbarGeometry);
        
        // Add a skull looking upward at the base
        const skullGeometry = this.createSphereSkull(skullColor);
        
        // Position skull at the base of the cross, rotated to look upward
        const skullMatrix = new THREE.Matrix4()
            .makeRotationX(-Math.PI/4) // Rotate to look up
            .multiply(new THREE.Matrix4().makeScale(0.7, 0.7, 0.7)) // Slightly smaller
            .setPosition(0, -2.1, 0.6); // Position at base of cross, slightly forward
        
        skullGeometry.applyMatrix4(skullMatrix);
        parts.push(skullGeometry);
        
        // Add some debris/stones around the base
        for (let i = 0; i < 5; i++) {
            const stoneSize = 0.2 + Math.random() * 0.3;
            const stoneGeometry = new THREE.BoxGeometry(stoneSize, stoneSize, stoneSize);
            
            // Position randomly around the base
            const angle = Math.random() * Math.PI * 2;
            const distance = 0.5 + Math.random() * 0.8;
            const x = Math.sin(angle) * distance;
            const z = Math.cos(angle) * distance;
            
            // Stone color - darker than the cross
            const stoneColor = crossColor.clone().multiplyScalar(0.6);
            this.addVertexColors(stoneGeometry, stoneColor, 0.15);
            
            // Random rotation for the stone
            const rotation = new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            const matrix = new THREE.Matrix4();
            const quat = new THREE.Quaternion().setFromEuler(rotation);
            matrix.makeRotationFromQuaternion(quat);
            matrix.setPosition(x, -2.2, z); // Position at ground level
            
            stoneGeometry.applyMatrix4(matrix);
            parts.push(stoneGeometry);
        }
        
        // Merge all parts
        return this.mergeBufferGeometries(parts);
    }
}
