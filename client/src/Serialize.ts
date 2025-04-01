import * as THREE from 'three';
import { Level } from './Level';
import { LevelBuilder } from './LevelBuilder';
import { Rope } from './Rope';
import { ActionArea } from './ActionArea';
import { Updraft } from './Updraft';

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
    saws: SawData[];
    actionAreas: ActionAreaData[];
    updrafts: UpdraftData[];
    playerStartPosition?: number[];
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
 * Interface for saw data
 */
interface SawData {
    position: number[];
    rotation: number[];
    radius: number;
    thickness: number;
    spinSpeed: number;
    name: string;
}

/**
 * Interface for action area data
 */
interface ActionAreaData {
    position: number[];
    size: number[];
    triggerOnce: boolean;
    name: string;
}

/**
 * Interface for updraft data
 */
interface UpdraftData {
    position: number[];
    size: number[];
    strength: number;
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
        // Import Saw dynamically to avoid circular dependencies
        import('./Saw').then(({ Saw }) => {});
        
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
            }),
            saws: level.entities
                .filter(entity => entity.constructor.name === 'Saw')
                .map(saw => {
                    const mesh = saw.getCollisionMesh();
                    return {
                        position: [
                            mesh.position.x,
                            mesh.position.y,
                            mesh.position.z
                        ],
                        rotation: [
                            mesh.rotation.x,
                            mesh.rotation.y,
                            mesh.rotation.z
                        ],
                        radius: 4.0, // We'll use default values since they're not easily accessible
                        thickness: 1.0,
                        spinSpeed: 0.1,
                        name: mesh.name || `saw_${Date.now()}`
                    };
                }),
            actionAreas: level.actionAreas.map(area => {
                const shape = area.getShape();
                if (!shape) {
                    // Fallback if shape is null
                    return {
                        position: [0, 0, 0],
                        size: [1, 1, 1],
                        triggerOnce: false,
                        name: `actionarea_${Date.now()}`
                    };
                }
                
                const bounds = shape.getBoundingBox();
                const size = new THREE.Vector3(
                    bounds.max.x - bounds.min.x,
                    bounds.max.y - bounds.min.y,
                    bounds.max.z - bounds.min.z
                );
                
                return {
                    position: [
                        shape.position.x,
                        shape.position.y,
                        shape.position.z
                    ],
                    size: [
                        size.x,
                        size.y,
                        size.z
                    ],
                    triggerOnce: false, // We can't access this private property, so default to false
                    name: `actionarea_${Date.now()}`
                };
            }),
            updrafts: level.updrafts.map(updraft => {
                const shape = updraft.getShape();
                if (!shape) {
                    // Fallback if shape is null
                    return {
                        position: [0, 0, 0],
                        size: [1, 20, 1],
                        strength: 0.1,
                        name: `updraft_${Date.now()}`
                    };
                }
                
                const bounds = shape.getBoundingBox();
                const size = new THREE.Vector3(
                    bounds.max.x - bounds.min.x,
                    bounds.max.y - bounds.min.y,
                    bounds.max.z - bounds.min.z
                );
                
                return {
                    position: [
                        shape.position.x,
                        shape.position.y,
                        shape.position.z
                    ],
                    size: [
                        size.x,
                        size.y,
                        size.z
                    ],
                    strength: 0.1, // Default since we can't access private property
                    name: `updraft_${Date.now()}`
                };
            }),
            playerStartPosition: level.playerStartPosition ? 
                [level.playerStartPosition.x, level.playerStartPosition.y, level.playerStartPosition.z] : 
                undefined
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
            const promptResult = prompt("Enter a name for your level:", "level1");
            if (!promptResult) return; // User cancelled
            levelName = promptResult;
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
            level.actionAreas = [];
            level.updrafts = [];
            
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
                        
                        // Add to scene if provided (but don't add to level again)
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
            
            // Load saws
            if (levelData.saws && Array.isArray(levelData.saws)) {
                // Import Saw dynamically
                import('./Saw').then(({ Saw }) => {
                    levelData.saws.forEach((sawData: SawData) => {
                        // Create a saw at the correct position directly
                        const position = new THREE.Vector3(
                            sawData.position[0],
                            sawData.position[1],
                            sawData.position[2]
                        );
                        
                        // Create the saw with the correct position
                        const saw = Saw.create(
                            position,
                            sawData.radius,
                            sawData.thickness,
                            sawData.spinSpeed,
                        );
                        
                        // Apply rotation if provided
                        if (sawData.rotation && sawData.rotation.length === 3) {
                            saw.mesh.rotation.set(
                                sawData.rotation[0],
                                sawData.rotation[1],
                                sawData.rotation[2]
                            );
                            
                            // Update the body's shape orientation
                            if (saw.body && saw.body.shape) {
                                saw.body.shape.orientation.setFromEuler(new THREE.Euler(
                                    sawData.rotation[0],
                                    sawData.rotation[1],
                                    sawData.rotation[2]
                                ));
                                saw.body.shape.updateTransform();
                            }
                        }
                        
                        // Name the saw
                        saw.mesh.name = sawData.name || `saw_${Date.now()}`;
                        
                        // Add to level
                        level.addSaw(saw);
                    });
                    
                    console.log(`Loaded ${levelData.saws.length} saws`);
                });
            }
            
            // Load action areas
            if (levelData.actionAreas && Array.isArray(levelData.actionAreas)) {
                levelData.actionAreas.forEach((areaData: ActionAreaData) => {
                    const position = new THREE.Vector3(
                        areaData.position[0],
                        areaData.position[1],
                        areaData.position[2]
                    );
                    
                    const size = new THREE.Vector3(
                        areaData.size[0],
                        areaData.size[1],
                        areaData.size[2]
                    );
                    
                    // Create a placeholder callback
                    const placeholderCallback = () => {
                        console.log(`Action area "${areaData.name}" triggered`);
                    };
                    
                    // Create the action area
                    const actionArea = level.addActionArea(
                        position,
                        size,
                        placeholderCallback,
                        areaData.triggerOnce
                    );
                    
                    // Add to scene for editor selection
                    if (scene) {
                        scene.add(actionArea.getCollisionMesh());
                    }
                });
                
                console.log(`Loaded ${levelData.actionAreas.length} action areas`);
            }
            
            // Load updrafts
            if (levelData.updrafts && Array.isArray(levelData.updrafts)) {
                levelData.updrafts.forEach((updraftData: UpdraftData) => {
                    const position = new THREE.Vector3(
                        updraftData.position[0],
                        updraftData.position[1],
                        updraftData.position[2]
                    );
                    
                    const size = new THREE.Vector3(
                        updraftData.size[0],
                        updraftData.size[1],
                        updraftData.size[2]
                    );
                    
                    // Create the updraft
                    const updraft = level.addUpdraft(
                        position,
                        size,
                        updraftData.strength
                    );
                    
                    // Add to scene for editor selection
                    if (scene) {
                        scene.add(updraft.getCollisionMesh());
                    }
                });
                
                console.log(`Loaded ${levelData.updrafts ? levelData.updrafts.length : 0} updrafts`);
            }
            
            // Load player start position if available
            if (levelData.playerStartPosition && levelData.playerStartPosition.length === 3) {
                level.playerStartPosition = new THREE.Vector3(
                    levelData.playerStartPosition[0],
                    levelData.playerStartPosition[1],
                    levelData.playerStartPosition[2]
                );
                console.log(`Loaded player start position: (${levelData.playerStartPosition[0]}, ${levelData.playerStartPosition[1]}, ${levelData.playerStartPosition[2]})`);
            } else {
                // Set a default if not found
                level.playerStartPosition = new THREE.Vector3(0, 50, 0);
                console.log("No player start position found in level data, using default");
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
