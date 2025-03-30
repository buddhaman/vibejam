import * as THREE from 'three';
import { Level } from './Level';
import { LevelBuilder } from './LevelBuilder';
import { Rope } from './Rope';

/**
 * Interface for level data
 */
export interface LevelData {
    name: string;
    author: string;
    version: number;
    created: string;
    platforms: PlatformData[];
    ropes: RopeData[];
}

/**
 * Interface for platform data
 */
interface PlatformData {
    position: number[];
    rotation: number[];
    scale: number[];
    color: string;
    name: string;
}

/**
 * Interface for rope data
 */
interface RopeData {
    startPos: number[];
    endPos: number[];
    segments: number;
    length: number;
    name: string;
}

/**
 * Class for serializing and deserializing level data
 */
export class Serialize {
    /**
     * Save a level to JSON
     * @param level The level to save
     * @returns JSON string of the level data
     */
    public static saveLevel(level: Level): string {
        // Create level data object
        const levelData: LevelData = {
            name: "Custom Level",
            author: "Level Editor",
            version: 1,
            created: new Date().toISOString(),
            platforms: level.staticBodies.map(platform => ({
                position: [
                    platform.mesh.position.x,
                    platform.mesh.position.y,
                    platform.mesh.position.z
                ],
                rotation: [
                    platform.mesh.rotation.x,
                    platform.mesh.rotation.y,
                    platform.mesh.rotation.z
                ],
                scale: [
                    platform.mesh.scale.x,
                    platform.mesh.scale.y,
                    platform.mesh.scale.z
                ],
                color: platform.mesh.material instanceof THREE.MeshStandardMaterial 
                    ? '#' + platform.mesh.material.color.getHexString()
                    : '#888888',
                name: platform.mesh.name || ''
            })),
            ropes: level.ropes.map(rope => {
                // Get the start position from the fixedPoint property
                const startPos = rope.fixedPoint.clone();
                
                // For end position, get the last particle position
                const particles = rope.verletBody.getParticles();
                const endPos = particles[particles.length - 1].position.clone();
                
                return {
                    startPos: [startPos.x, startPos.y, startPos.z],
                    endPos: [endPos.x, endPos.y, endPos.z],
                    length: rope.totalLength,
                    segments: rope.segments,
                    name: rope.name || `rope_${Date.now()}`
                };
            })
        };
        
        // Convert to JSON string
        return JSON.stringify(levelData, null, 2);
    }
    
    /**
     * Download a level to a file
     * @param level The level to save
     * @param filename Optional filename (defaults to prompt)
     */
    public static downloadLevel(level: Level, filename?: string): void {
        const jsonString = this.saveLevel(level);
        
        // Create a text input for the level name if not provided
        let levelName = filename;
        if (!levelName) {
            levelName = prompt("Enter a name for your level:", "level1");
            if (!levelName) return; // User cancelled
        }
        
        // Create filename
        const finalFilename = levelName.endsWith('.json') ? levelName : `${levelName}.json`;
        
        // Create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        console.log(`Level saved to ${finalFilename}`);
    }
    
    /**
     * Load a level from JSON string
     * @param level The level object to populate
     * @param jsonString JSON string containing level data
     * @param scene Optional THREE.Scene to add objects to
     * @returns True if successful, false otherwise
     */
    public static loadLevelFromString(level: Level, jsonString: string, scene?: THREE.Scene): boolean {
        try {
            const levelData = JSON.parse(jsonString) as LevelData;
            
            // Clear existing level (entities will be re-added)
            level.staticBodies = [];
            level.entities = [];
            level.ropes = [];
            
            // Load platforms
            if (levelData.platforms && Array.isArray(levelData.platforms)) {
                levelData.platforms.forEach((platformData: PlatformData) => {
                    // Create a platform with a temporary position
                    const platform = LevelBuilder.createHorizontalPlatform(
                        level,
                        new THREE.Vector3(0, 0, 0), // Create at origin first
                        1, // Default width 
                        1, // Default depth
                        1, // Default height
                        new THREE.MeshStandardMaterial({ 
                            color: new THREE.Color(platformData.color || '#FF0000'),
                            roughness: 0.7
                        }),
                        platformData.name || `platform_${Date.now()}`
                    );
                    
                    if (platform && platform.mesh) {
                        // Now explicitly set position, rotation, and scale
                        platform.mesh.position.set(
                            platformData.position[0],
                            platformData.position[1],
                            platformData.position[2]
                        );
                        
                        platform.mesh.rotation.set(
                            platformData.rotation[0],
                            platformData.rotation[1],
                            platformData.rotation[2]
                        );
                        
                        platform.mesh.scale.set(
                            platformData.scale[0],
                            platformData.scale[1],
                            platformData.scale[2]
                        );
                        
                        // Update the shape to match the mesh
                        if (platform.shape) {
                            platform.shape.position.copy(platform.mesh.position);
                            platform.shape.orientation.setFromEuler(new THREE.Euler(
                                platformData.rotation[0],
                                platformData.rotation[1],
                                platformData.rotation[2]
                            ));
                            platform.shape.scaling.copy(platform.mesh.scale);
                            platform.shape.updateTransform();
                        }
                        
                        // Add to level
                        level.addStaticBody(platform);
                        
                        // Add to scene if provided
                        if (scene && !platform.mesh.parent) {
                            scene.add(platform.mesh);
                        }
                    }
                });
                
                console.log(`Loaded level with ${levelData.platforms.length} platforms`);
            }
            
            // Load ropes
            if (levelData.ropes && Array.isArray(levelData.ropes)) {
                levelData.ropes.forEach((ropeData: RopeData) => {
                    const startPos = new THREE.Vector3(
                        ropeData.startPos[0],
                        ropeData.startPos[1],
                        ropeData.startPos[2]
                    );
                    
                    // Create the rope with proper parameters
                    const rope = level.addRope(
                        startPos,
                        ropeData.segments || 10,
                        ropeData.length || 5,
                        0.1
                    );
                    
                    // Name the rope
                    rope.name = ropeData.name || `rope_${Date.now()}`;
                    
                    // Add to scene if provided
                    if (scene) {
                        const ropeMesh = rope.getCollisionMesh();
                        if (ropeMesh && !ropeMesh.parent) {
                            scene.add(ropeMesh);
                        }
                    }
                    
                    // Force an update to apply physics
                    rope.update();
                });
                
                console.log(`Loaded level with ${levelData.platforms.length} platforms and ${levelData.ropes.length} ropes`);
            }
            
            // Show metadata if available
            if (levelData.name || levelData.author) {
                console.log(`Level info: ${levelData.name || 'Unnamed'} by ${levelData.author || 'Unknown'}`);
            }
            
            return true;
        } catch (error) {
            console.error("Error loading level:", error);
            return false;
        }
    }
    
    /**
     * Load a level from a file using file picker
     * @param level The level object to populate
     * @param scene Optional THREE.Scene to add objects to
     * @param callback Optional callback function after loading
     */
    public static loadLevelFromFile(level: Level, scene?: THREE.Scene, callback?: (success: boolean) => void): void {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        // Handle file selection
        fileInput.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                if (callback) callback(false);
                return;
            }
            
            // Read the file
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    
                    // Show confirmation dialog
                    const confirmLoad = confirm(`Load level "${file.name}"? This will replace your current level.`);
                    if (!confirmLoad) {
                        if (callback) callback(false);
                        return;
                    }
                    
                    // Load the level
                    const success = this.loadLevelFromString(level, content, scene);
                    if (callback) callback(success);
                    
                } catch (error) {
                    console.error("Error loading level:", error);
                    alert("Error loading level. See console for details.");
                    if (callback) callback(false);
                }
            };
            
            reader.readAsText(file);
        };
        
        // Trigger file selection
        fileInput.click();
    }
}
