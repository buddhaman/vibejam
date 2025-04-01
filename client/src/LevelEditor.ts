import * as THREE from 'three';
import { Game } from "./Game";
import { Level } from "./Level";
import { LevelRenderer } from './LevelRenderer';
import { CameraMode } from './Camera';
import { LevelBuilder } from './LevelBuilder';
import { ConvexShape } from '../../shared/ConvexShape';
import { RigidBody } from './RigidBody';
import { StaticBody } from './StaticBody';
import { Rope } from './Rope';
// Replace the import with a type declaration
// import type { TransformControls as TransformControlsType } from 'three/examples/jsm/controls/TransformControls';
import { Box3, Box3Helper } from 'three';
import { Serialize } from './Serialize';
import { Saw } from './Saw';
import { ActionArea } from './ActionArea';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Define a generic type for TransformControls
type TransformControlsType = any;

export class LevelEditor {
    private game: Game;
    private level: Level;
    private levelRenderer: LevelRenderer;
    
    // Selection handling
    private selectedObject: THREE.Object3D | null = null;
    private transformControls: TransformControlsType | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private isDragging: boolean = false;


    // Add properties to track the transform panel
    private transformPanel: HTMLDivElement | null = null;
    private posXInput: HTMLInputElement | null = null;
    private posYInput: HTMLInputElement | null = null;
    private posZInput: HTMLInputElement | null = null;
    private rotXInput: HTMLInputElement | null = null;
    private rotYInput: HTMLInputElement | null = null;
    private rotZInput: HTMLInputElement | null = null;
    private scaleXInput: HTMLInputElement | null = null;
    private scaleYInput: HTMLInputElement | null = null;
    private scaleZInput: HTMLInputElement | null = null;

    // Add this property to your class
    private boundingBoxHelpers: THREE.Box3Helper[] = [];
    private showBoundingBoxes: boolean = false;

    // Add this property to track when transform controls are released
    private lastTransformReleaseTime: number = 0;

    // Add a flag to track if we're in test mode
    private inTestMode: boolean = false;

    /**
     * Check if the editor should be activated based on URL parameters
     */
    public static shouldActivateEditor(): boolean {
        const editorInPath = window.location.pathname.includes('/leveleditor');
        const urlParams = new URLSearchParams(window.location.search);
        const editorInParams = urlParams.has('editor') || urlParams.has('leveleditor');
        
        return editorInPath || editorInParams;
    }

    /**
     * Initialize the level editor
     */
    constructor(game: Game) {
        console.log("Initializing Level Editor...");
        this.game = game;
        
        // Create a level specifically for the editor
        this.levelRenderer = this.game.levelRenderer!;
        this.level = this.game.level!;

        // Set camera to first-person flying mode for the editor
        this.levelRenderer.camera.setMode(CameraMode.FIRST_PERSON_FLYING);
        
        // Set document title
        document.title = "Level Editor - 3D Platformer";
        
        // Hide standard game controls and disable level switching
        this.hideGameControls();
        this.disableLevelSwitching();
        
        // Setup UI and controls
        this.setupEditorUI();
        this.createTransformPanel();
        this.setupSelectionControls();
        this.game.doLevelUpdate = false;

    }

    /**
     * Disable level switching functionality
     */
    private disableLevelSwitching(): void {
        // Overwrite the game's switchLevel method with an empty function
        if (this.game) {
            this.game.switchLevel = () => {
                console.log("Level switching is disabled in editor mode");
            };
            
            // Also remove keyboard handlers for level switching by redefining keydown event
            if (this.game.keydownListener) {
                window.removeEventListener('keydown', this.game.keydownListener);
            }
            
            // Create a new keydown listener that doesn't handle level switching
            this.game.keydownListener = (event) => {
                this.game.inputKeys[event.key.toLowerCase()] = true;
                
                // Only handle camera movement in editor mode
                if (this.levelRenderer?.camera.getMode() === CameraMode.FIRST_PERSON_FLYING) {
                    this.game.handleCameraMovementKey(event.key, true);
                }
            };
            
            // Add the new listener
            window.addEventListener('keydown', this.game.keydownListener);
        }
    }

    /**
     * Hide standard game controls
     */
    private hideGameControls(): void {
        // Hide fullscreen controls container if it exists
        const fullscreenControls = document.getElementById('fullscreen-controls-container');
        if (fullscreenControls) {
            fullscreenControls.style.display = 'none';
        }
        
        // Hide mobile controls if they exist
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
            (mobileControls as HTMLElement).style.display = 'none';
        }
        
        // Hide any other game UI elements
        const gameUIElements = document.querySelectorAll('.game-ui');
        gameUIElements.forEach(element => {
            (element as HTMLElement).style.display = 'none';
        });
        
        // If there's an escape message, hide that too
        const escapeMsg = document.getElementById('escape-message');
        if (escapeMsg) {
            escapeMsg.style.display = 'none';
        }
    }

    /**
     * Set up the editor UI components
     */
    private setupEditorUI(): void {
        console.log("Setting up editor UI...");
        // Add editor label
        const infoLabel = document.createElement('div');
        infoLabel.textContent = "LEVEL EDITOR MODE";
        infoLabel.classList.add('editor-ui');
        infoLabel.style.position = 'fixed';
        infoLabel.style.top = '10px';
        infoLabel.style.left = '50%';
        infoLabel.style.transform = 'translateX(-50%)';
        infoLabel.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        infoLabel.style.color = 'white';
        infoLabel.style.padding = '5px 10px';
        infoLabel.style.borderRadius = '5px';
        infoLabel.style.fontFamily = 'Arial, sans-serif';
        infoLabel.style.fontWeight = 'bold';
        infoLabel.style.zIndex = '9999';
        document.body.appendChild(infoLabel);

        // Add help text for controls
        const helpText = document.createElement('div');
        helpText.textContent = "Editor Controls: WASD = Move, Space = Up, Shift = Down, Alt/Ctrl = Sprint, G/R/S = Transform Modes";
        helpText.classList.add('editor-ui');
        helpText.style.position = 'fixed';
        helpText.style.bottom = '10px';
        helpText.style.left = '10px';
        helpText.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        helpText.style.color = 'white';
        helpText.style.padding = '5px 10px';
        helpText.style.borderRadius = '5px';
        helpText.style.fontFamily = 'Arial, sans-serif';
        helpText.style.fontSize = '12px';
        helpText.style.zIndex = '9999';
        document.body.appendChild(helpText);
        
        // Create editor toolbar
        this.createEditorToolbar();
    }
    
    /**
     * Create the editor toolbar with buttons
     */
    private createEditorToolbar(): void {
        const toolbar = document.createElement('div');
        toolbar.classList.add('editor-ui');
        toolbar.style.position = 'fixed';
        toolbar.style.top = '50px';
        toolbar.style.left = '10px';
        toolbar.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        toolbar.style.padding = '10px';
        toolbar.style.borderRadius = '5px';
        toolbar.style.display = 'flex';
        toolbar.style.flexDirection = 'column';
        toolbar.style.gap = '10px';
        toolbar.style.zIndex = '9998';
        
        // Add Platform button
        const addPlatformBtn = this.createButton('Add Platform', () => this.addPlatform());
        toolbar.appendChild(addPlatformBtn);
        
        // Add Rope button
        const addRopeBtn = this.createButton('Add Rope', () => this.addRope());
        toolbar.appendChild(addRopeBtn);
        
        // Add Player Start button
        const addPlayerStartBtn = this.createButton('Add Player Start', () => this.addPlayerStart());
        toolbar.appendChild(addPlayerStartBtn);
        
        // Add Action Area button
        const addActionAreaBtn = this.createButton('Add Action Area', () => this.addActionArea());
        addActionAreaBtn.style.backgroundColor = '#00AAFF';
        toolbar.appendChild(addActionAreaBtn);
        
        // Add Saw button
        const addSawBtn = this.createButton('Add Saw', () => this.addSaw());
        toolbar.appendChild(addSawBtn);
        
        // Add delete button 
        const deleteBtn = this.createButton('Delete Selected', () => this.deleteSelected());
        toolbar.appendChild(deleteBtn);
        
        // Add Save/Load buttons
        const saveBtn = this.createButton('Save Level', () => this.saveLevel());
        toolbar.appendChild(saveBtn);
        
        const loadBtn = this.createButton('Load Level', () => this.loadLevel());
        toolbar.appendChild(loadBtn);
        
        // Add toggle for bounding boxes
        const toggleBoxesBtn = this.createButton('Toggle Bounding Boxes', () => this.toggleBoundingBoxes());
        toolbar.appendChild(toggleBoxesBtn);
        
        // Add Test Level button
        const testLevelBtn = this.createButton('Test Level', () => this.toggleTestMode());
        testLevelBtn.style.backgroundColor = '#9933CC'; // Purple color to stand out
        toolbar.appendChild(testLevelBtn);
        
        document.body.appendChild(toolbar);
    }
    
    /**
     * Helper to create a styled button
     */
    private createButton(text: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.padding = '8px 12px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Arial, sans-serif';
        button.style.fontSize = '14px';
        button.style.width = '100%';
        button.style.transition = 'background-color 0.2s';
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#3e8e41';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#4CAF50';
        });
        
        // Only respond to actual clicks, not spacebar presses
        button.addEventListener('click', (event) => {
            // Only proceed if it's a mouse click, not a keyboard event
            if (event.detail > 0) {
                onClick();
            }
        });
        
        // Prevent spacebar from triggering the button
        button.addEventListener('keydown', (event) => {
            if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
            }
        });
        
        return button;
    }
    
    /**
     * Set up selection and transformation controls
     */
    private setupSelectionControls(): void {
            // Create transform controls
            this.transformControls = new TransformControls(
                this.levelRenderer.camera.threeCamera, 
                this.levelRenderer.renderer.domElement
            );
            this.transformControls
            
            // Add to scene
            this.levelRenderer.scene.add(this.transformControls);
            
            // Set up events for the transform controls
            //this.setupTransformControlsEvents();
            
            // Add event listener to handle transform mode changes
            window.addEventListener('keydown', (event) => {
                // Skip shortcut processing if focused on an input element
                const activeElement = document.activeElement;
                const isInputActive = activeElement && (
                    activeElement.tagName === 'INPUT' || 
                    activeElement.tagName === 'TEXTAREA'
                );
                
                if (isInputActive) {
                    return; // Don't process shortcuts when editing text
                }
                
                if (!this.selectedObject) return;
                
                switch (event.key.toLowerCase()) {
                    case 'g': // Move (grab)
                        this.transformControls!.setMode('translate');
                        break;
                    case 'r': // Rotate
                        this.transformControls!.setMode('rotate');
                        break;
                    case 'x': // Scale (changed from 's' to 'x')
                        this.transformControls!.setMode('scale');
                        break;
                    case 'delete': // Delete selected object
                    case 'backspace':
                        this.deleteSelected();
                        break;
                }
            });
            
            // Make transform controls disable camera controls while dragging
            this.transformControls.addEventListener('dragging-changed', (event: any) => {
                this.isDragging = event.value;
            });
        
        // Add click event listener for selection
        const canvas = this.levelRenderer.renderer.domElement;
        
        // Track mouse position and state for better click handling
        let mouseDownTime = 0;
        let mouseDownPos = new THREE.Vector2();
        
        canvas.addEventListener('mousedown', (event) => {
            // Record the time and position when mouse is pressed
            mouseDownTime = Date.now();
            mouseDownPos.set(event.clientX, event.clientY);
        });
        
        canvas.addEventListener('click', (event) => {
            // Skip if we're dragging with transform controls
            if (this.isDragging) return;
            
            // Ignore click events that happen shortly after releasing transform controls
            // This prevents accidental reselection
            if (Date.now() - this.lastTransformReleaseTime < 300) {
                return;
            }
            
            // Make sure this was a real click, not the end of a drag
            // Calculate distance moved since mousedown
            const distance = Math.sqrt(
                Math.pow(mouseDownPos.x - event.clientX, 2) + 
                Math.pow(mouseDownPos.y - event.clientY, 2)
            );
            
            // Skip if mouse moved more than a small threshold (indicating a drag, not a click)
            if (distance > 5) {
                return;
            }
            
            // Calculate mouse position
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // Raycast to find intersected objects
            this.raycaster.setFromCamera(this.mouse, this.levelRenderer.camera.threeCamera);
            
            // Create a list of all selectable objects
            const selectables = [
                ...this.level.entities.map(entity => entity.getCollisionMesh()),
                // Also include player start marker in selectables
                ...this.levelRenderer.scene.children.filter(obj => obj.userData && obj.userData.isPlayerStart)
            ].filter(Boolean);
            
            // Check for intersections
            const intersects = this.raycaster.intersectObjects(selectables, false);
            
            if (intersects.length > 0) {
                // Select the first intersected object
                this.selectObject(intersects[0].object);
            } else {
                // Deselect if clicked nothing
                this.deselectObject();
            }
        });
    }
    
    /**
     * Select an object and attach transform controls
     */
    private selectObject(object: THREE.Object3D): void {
        // Deselect previous object
        this.deselectObject();
        
        // Set new selected object
        this.selectedObject = object;
        
        // Highlight the selected object
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
            // Store original color for restoration later
            if (!object.userData.originalColor) {
                if (object.material.color) {
                    object.userData.originalColor = object.material.color.clone();
                }
            }
            
            // Set highlight color (lighter version of original)
            const highlightColor = new THREE.Color(0x88ff88);
            object.material.emissive = highlightColor;
        }
        
        // Attach transform controls if available
        if (this.transformControls) {
            this.transformControls.attach(object);
            this.transformControls.setMode('translate'); // Default to translate mode
            
            // Adjust the transform controls to have smaller translations
            this.transformControls.setTranslationSnap(0.5); // Snap to 0.5 unit grid
            this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(5)); // Make rotation less sensitive (5 degrees)
            this.transformControls.setScaleSnap(0.1); // Snap scale to 0.1 increments
        }
        
        console.log('Selected object:', object.name || 'Unnamed Object');
        
        // Update transform panel with object values
        this.updateTransformPanel();
    }
    
    /**
     * Deselect the current object
     */
    private deselectObject(): void {
        if (this.selectedObject) {
            // Remove highlight
            if (this.selectedObject instanceof THREE.Mesh && 
                this.selectedObject.material instanceof THREE.MeshStandardMaterial) {
                // Reset emissive color
                this.selectedObject.material.emissive = new THREE.Color(0x000000);
            }
            
            // Detach transform controls
            if (this.transformControls) {
                this.transformControls.detach();
            }
            
            // Hide transform panel
            if (this.transformPanel) {
                this.transformPanel.style.display = 'none';
            }
            
            this.selectedObject = null;
        }
    }
    
    /**
     * Get a position to place new objects based on camera position
     * @param distance Distance in front of camera to place the object
     * @param yOffset Vertical offset from camera position
     * @returns Position vector for the new object
     */
    private getPlacePosition(distance: number = 10, yOffset: number = -1): THREE.Vector3 {
        // Get camera position and forward direction
        const cameraPos = this.levelRenderer.camera.getPosition();
        const forwardDir = this.levelRenderer.camera.getForwardVector();
        
        // Position the object at specified distance in front of the camera
        const position = cameraPos.clone().add(forwardDir.multiplyScalar(distance));
        position.y += yOffset; // Apply vertical offset
        
        return position;
    }

    /**
     * Add a new platform at the camera's position
     */
    private addPlatform(): void {
        // Get position for the new platform
        const platformPos = this.getPlacePosition(10, -1);
        
        // Use the standard red color from LevelBuilder
        const color = new THREE.Color(0xFF0000); // Red color
        
        // Platform name
        const platformName = `platform_${Date.now()}`;
        
        // Create platform at origin first
        const platform = LevelBuilder.createHorizontalPlatform(
            this.level,
            new THREE.Vector3(0, 0, 0),
            1, // width
            1, // depth
            1, // height
            new THREE.MeshStandardMaterial({ 
                color: color,
                roughness: 0.7,
            }),
            platformName
        );

        // Set the shape's position to our desired world position
        let scale = new THREE.Vector3(4,4,4);
        platform.shape.scaling.copy(scale);
        platform.mesh.scale.copy(scale);
        platform.shape.position.copy(platformPos);
        platform.mesh.position.copy(platformPos);
        
        // Update the transform which will cascade to the mesh
        platform.shape.updateTransform();
        
        // Add to scene if needed
        if (!platform.mesh.parent) {
            this.levelRenderer.scene.add(platform.mesh);
        }
        
        // Select the new platform
        this.selectObject(platform.mesh);
        
        console.log(`Added new platform: ${platformName}`);
    }
    
    /**
     * Add a new rope
     */
    private addRope(): void {
        // Get position for the rope start point
        const startPos = this.getPlacePosition(10, -1);
        
        // Get position for the rope end point
        const endPos = startPos.clone();
        endPos.y -= 20;
        
        // Create a unique name
        const ropeName = `rope_${Date.now()}`;
        
        // Create the rope with correct parameters
        const distanceToEnd = startPos.distanceTo(endPos);
        
        // Add rope to level and scene
        let rope = this.level.addRope(startPos, 14, distanceToEnd, 0.1);
        this.levelRenderer.scene.add(rope.getCollisionMesh());
        rope.update();
        
        console.log(`Added new rope: ${ropeName}`);
    }
    
    /**
     * Add a player start position marker (purple cube)
     */
    private addPlayerStart(): void {
        // Remove any existing player start markers
        this.removeExistingPlayerStart();
        
        // Get position for the player start (high up)
        const startPos = this.getPlacePosition(10, -1);
        
        // Create a purple cube to mark the player start
        const geometry = new THREE.BoxGeometry(2, 5, 2); // Player-sized box
        const material = new THREE.MeshStandardMaterial({
            color: 0x8822cc, // Purple color
            transparent: true,
            opacity: 0.8,
            emissive: 0x220066, // Slight glow
        });
        
        const playerStartMarker = new THREE.Mesh(geometry, material);
        playerStartMarker.position.copy(startPos);
        playerStartMarker.name = "player_start_position";
        playerStartMarker.userData.isPlayerStart = true;
        
        // Add to scene
        this.levelRenderer.scene.add(playerStartMarker);
        
        // Set the player start position in the level data
        this.level.playerStartPosition.copy(startPos);
        
        // Select the marker
        this.selectObject(playerStartMarker);
        
        console.log(`Added player start position at ${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)}`);
    }

    /**
     * Remove any existing player start markers
     */
    private removeExistingPlayerStart(): void {
        // Find any existing player start markers
        const existingMarker = this.levelRenderer.scene.children.find(
            obj => obj.name === "player_start_position" || (obj.userData && obj.userData.isPlayerStart)
        );
        
        if (existingMarker) {
            // If currently selected, deselect first
            if (this.selectedObject === existingMarker) {
                this.deselectObject();
            }
            
            // Remove from scene
            this.levelRenderer.scene.remove(existingMarker);
            console.log("Removed existing player start marker");
        }
    }
    
    /**
     * Delete the currently selected object
     */
    private deleteSelected(): void {
        if (!this.selectedObject) return;
        
        // Check if the selected object is a player start marker
        if (this.selectedObject.userData && this.selectedObject.userData.isPlayerStart) {
            // If currently selected, deselect first
            this.deselectObject();
            
            // Remove from scene
            this.levelRenderer.scene.remove(this.selectedObject);
            console.log("Removed player start marker");
            return;
        }
        
        // Find the entity associated with the selected object
        const entity = this.level.entities.find(e => e.getCollisionMesh() === this.selectedObject);
        
        if (entity) {
            // Deselect the object before removing it
            this.deselectObject();
            
            // Use the Level.removeEntity method to remove the entity
            const removed = this.level.removeEntity(entity);
            
            if (removed) {
                console.log(`Successfully removed ${entity.constructor.name}`);
            } else {
                console.error(`Failed to remove ${entity.constructor.name}`);
            }
        } else {
            // If no entity was found, just remove the mesh from the scene
            console.log("No entity found for selected object, removing mesh only");
            this.deselectObject();
            
            if (this.selectedObject.parent) {
                this.selectedObject.parent.remove(this.selectedObject);
            }
        }
        
        // Update bounding boxes if they're visible
        if (this.showBoundingBoxes) {
            this.showAllBoundingBoxes();
        }
    }
    
    /**
     * Save the current level to JSON
     */
    private saveLevel(): void {
        // Make sure player start position is updated if marker exists
        const playerStartMarker = this.levelRenderer.scene.children.find(
            obj => obj.name === "player_start_position" || (obj.userData && obj.userData.isPlayerStart)
        ) as THREE.Mesh;
        
        this.level.playerStartPosition = playerStartMarker.position.clone();
        
        // Use the Serialize class to download the level
        Serialize.downloadLevel(this.level);
    }
    
    /**
     * Load a level from JSON file
     */
    private loadLevel(): void {
        // Use the Serialize class to load the level from file
        this.clearLevel();
        Serialize.loadLevelFromFile(this.level, this.levelRenderer.scene, (success) => {
            if (success) {
                console.log("Level loaded successfully");
                
                // Update bounding boxes if they're visible
                if (this.showBoundingBoxes) {
                    this.showAllBoundingBoxes();
                }
                
                // Create player start marker if position exists
                if (this.level.playerStartPosition) {
                    this.removeExistingPlayerStart(); // Remove any existing marker
                    
                    // Create a new marker at the saved position
                    const geometry = new THREE.BoxGeometry(1, 2, 1);
                    const material = new THREE.MeshStandardMaterial({
                        color: 0x8822cc,
                        transparent: true,
                        opacity: 0.8,
                        emissive: 0x220066,
                    });
                    
                    const playerStartMarker = new THREE.Mesh(geometry, material);
                    playerStartMarker.position.copy(this.level.playerStartPosition);
                    playerStartMarker.name = "player_start_position";
                    playerStartMarker.userData.isPlayerStart = true;
                    
                    this.levelRenderer.scene.add(playerStartMarker);
                }
            }
        });
    }
    
    /**
     * Clear the current level
     */
    private clearLevel(): void {
        // Note: we don't need to create a new Level anymore since loadLevelFromString
        // now properly clears the existing level
        this.level.staticBodies = [];
        this.level.entities = [];
        this.level.ropes = [];
        this.level.actionAreas = [];
        this.level.saws = [];
        this.levelRenderer.reset(this.level);
        
        // Very important: deselect any currently selected object
        // to ensure transform controls are properly reset
        this.deselectObject();
        
        // Make sure transform controls are properly added to the scene again
        if (this.transformControls && !this.transformControls.parent) {
            this.levelRenderer.scene.add(this.transformControls);
        }
    }

    private setupTransformControlsEvents(): void {
        if (!this.transformControls) return;
        
        // When object is transformed, update the underlying shape
        this.transformControls.addEventListener('objectChange', () => {
            if (this.selectedObject) {
                // Try to find in regular entities
                let entity = this.level.entities.find(e => e.getCollisionMesh() === this.selectedObject);
                if (entity) {
                    const shape = entity.getShape();
                    if (shape) {
                        shape.position.copy(this.selectedObject.position);
                        shape.orientation.copy(this.selectedObject.quaternion);
                        shape.scaling.copy(this.selectedObject.scale);
                        shape.updateTransform();
                        entity.shapeChanged();
                        if(entity instanceof Rope)
                        {
                            for(let i = 0; i < 3; i++)
                                entity.update();
                        }
                    }
                } else {
                    // Check if it's a platform from staticBodies
                    const platform = this.level.staticBodies.find(p => p.mesh === this.selectedObject);
                    if (platform && platform.shape) {
                        platform.shape.position.copy(this.selectedObject.position);
                        platform.shape.orientation.copy(this.selectedObject.quaternion);
                        platform.shape.scaling.copy(this.selectedObject.scale);
                        platform.shape.updateTransform();
                    }
                }
                
                // Update the transform panel to reflect new values
                this.updateTransformPanel();
            }
        });
        
        // Tell the game that transform controls are active to prevent camera movement
        this.transformControls.addEventListener('mouseDown', () => {
            this.isDragging = true;
            // Set a global flag that the game can check
            if (this.game) {
                this.game.editorDraggingObject = true;
            }
        });
        
        this.transformControls.addEventListener('mouseUp', () => {
            this.isDragging = false;
            // Clear the global flag
            if (this.game) {
                this.game.editorDraggingObject = false;
            }
        });
        
        // Set rotation sensitivity - make it less sensitive
        this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15)); // Snap to 15 degrees
    }

    // Create a transform panel with text fields for position, rotation, and scale
    private createTransformPanel(): void {
        // Create the panel
        this.transformPanel = document.createElement('div');
        this.transformPanel.style.position = 'fixed';
        this.transformPanel.style.top = '50px';
        this.transformPanel.style.right = '10px';
        this.transformPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.transformPanel.style.padding = '10px';
        this.transformPanel.style.borderRadius = '5px';
        this.transformPanel.style.color = 'white';
        this.transformPanel.style.fontFamily = 'Arial, sans-serif';
        this.transformPanel.style.zIndex = '9998';
        this.transformPanel.style.width = '220px';
        this.transformPanel.style.display = 'none'; // Initially hidden
        
        // Create title
        const title = document.createElement('div');
        title.textContent = 'Transform Controls';
        title.style.fontSize = '16px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        this.transformPanel.appendChild(title);
        
        // Create sections for position, rotation, and scale
        this.transformPanel.appendChild(this.createTransformSection('Position', ['X', 'Y', 'Z'], (inputs) => {
            this.posXInput = inputs[0];
            this.posYInput = inputs[1];
            this.posZInput = inputs[2];
        }));
        
        this.transformPanel.appendChild(this.createTransformSection('Rotation', ['X', 'Y', 'Z'], (inputs) => {
            this.rotXInput = inputs[0];
            this.rotYInput = inputs[1];
            this.rotZInput = inputs[2];
        }));
        
        this.transformPanel.appendChild(this.createTransformSection('Scale', ['X', 'Y', 'Z'], (inputs) => {
            this.scaleXInput = inputs[0];
            this.scaleYInput = inputs[1];
            this.scaleZInput = inputs[2];
        }));
        
        // Create apply button
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply';
        applyButton.style.width = '100%';
        applyButton.style.padding = '5px';
        applyButton.style.marginTop = '10px';
        applyButton.style.backgroundColor = '#4CAF50';
        applyButton.style.color = 'white';
        applyButton.style.border = 'none';
        applyButton.style.borderRadius = '4px';
        applyButton.style.cursor = 'pointer';
        
        applyButton.addEventListener('click', () => this.applyTransform());
        this.transformPanel.appendChild(applyButton);
        
        // Add to body
        document.body.appendChild(this.transformPanel);
    }

    // Helper to create a transform section (position, rotation, or scale)
    private createTransformSection(title: string, labels: string[], callback: (inputs: HTMLInputElement[]) => void): HTMLDivElement {
        const section = document.createElement('div');
        section.style.marginBottom = '10px';
        
        // Section title
        const titleElem = document.createElement('div');
        titleElem.textContent = title;
        titleElem.style.marginBottom = '5px';
        section.appendChild(titleElem);
        
        // Create input grid
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '30px 1fr';
        grid.style.gap = '5px';
        
        const inputs: HTMLInputElement[] = [];
        
        // Create labeled inputs
        labels.forEach(label => {
            // Label
            const labelElem = document.createElement('div');
            labelElem.textContent = label;
            labelElem.style.textAlign = 'right';
            grid.appendChild(labelElem);
            
            // Input
            const input = document.createElement('input');
            input.type = 'number';
            input.step = title === 'Scale' ? '0.1' : '0.5';
            input.style.width = '100%';
            input.style.boxSizing = 'border-box';
            input.style.backgroundColor = '#333';
            input.style.color = 'white';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.padding = '3px';
            
            grid.appendChild(input);
            inputs.push(input);
        });
        
        section.appendChild(grid);
        
        // Call the callback with the inputs
        callback(inputs);
        
        return section;
    }

    // Apply the transform values from the text fields
    private applyTransform(): void {
        if (!this.selectedObject) return;
        
        try {
            // Get values from inputs
            const posX = this.posXInput ? parseFloat(this.posXInput.value) : 0;
            const posY = this.posYInput ? parseFloat(this.posYInput.value) : 0;
            const posZ = this.posZInput ? parseFloat(this.posZInput.value) : 0;
            
            const rotX = this.rotXInput ? THREE.MathUtils.degToRad(parseFloat(this.rotXInput.value)) : 0;
            const rotY = this.rotYInput ? THREE.MathUtils.degToRad(parseFloat(this.rotYInput.value)) : 0;
            const rotZ = this.rotZInput ? THREE.MathUtils.degToRad(parseFloat(this.rotZInput.value)) : 0;
            
            const scaleX = this.scaleXInput ? parseFloat(this.scaleXInput.value) : 1;
            const scaleY = this.scaleYInput ? parseFloat(this.scaleYInput.value) : 1;
            const scaleZ = this.scaleZInput ? parseFloat(this.scaleZInput.value) : 1;
            
            // Apply to the selected object
            this.selectedObject.position.set(posX, posY, posZ);
            this.selectedObject.rotation.set(rotX, rotY, rotZ);
            this.selectedObject.scale.set(scaleX, scaleY, scaleZ);
            
            // Update the platform's shape
            const platform = this.level.staticBodies.find(p => p.mesh === this.selectedObject);
            if (platform && platform.shape) {
                platform.shape.position.copy(this.selectedObject.position);
                platform.shape.orientation.setFromEuler(new THREE.Euler(rotX, rotY, rotZ));
                platform.shape.scaling.copy(this.selectedObject.scale);
                platform.shape.updateTransform();
            }
        } catch (e) {
            console.error("Error applying transform:", e);
        }
    }

    // Update values in the panel when an object is selected
    private updateTransformPanel(): void {
        if (!this.selectedObject || !this.transformPanel) return;
        
        // Show the panel
        this.transformPanel.style.display = 'block';
        
        // Update position values
        if (this.posXInput) this.posXInput.value = this.selectedObject.position.x.toFixed(2);
        if (this.posYInput) this.posYInput.value = this.selectedObject.position.y.toFixed(2);
        if (this.posZInput) this.posZInput.value = this.selectedObject.position.z.toFixed(2);
        
        // Update rotation values (convert to degrees)
        if (this.rotXInput) this.rotXInput.value = THREE.MathUtils.radToDeg(this.selectedObject.rotation.x).toFixed(1);
        if (this.rotYInput) this.rotYInput.value = THREE.MathUtils.radToDeg(this.selectedObject.rotation.y).toFixed(1);
        if (this.rotZInput) this.rotZInput.value = THREE.MathUtils.radToDeg(this.selectedObject.rotation.z).toFixed(1);
        
        // Update scale values
        if (this.scaleXInput) this.scaleXInput.value = this.selectedObject.scale.x.toFixed(2);
        if (this.scaleYInput) this.scaleYInput.value = this.selectedObject.scale.y.toFixed(2);
        if (this.scaleZInput) this.scaleZInput.value = this.selectedObject.scale.z.toFixed(2);
    }

    // Add this method to toggle bounding boxes
    private toggleBoundingBoxes(): void {
        this.showBoundingBoxes = !this.showBoundingBoxes;
        
        if (this.showBoundingBoxes) {
            this.showAllBoundingBoxes();
        } else {
            this.hideAllBoundingBoxes();
        }
        
        console.log(`Bounding boxes: ${this.showBoundingBoxes ? 'SHOWN' : 'HIDDEN'}`);
    }

    // Method to show all bounding boxes
    private showAllBoundingBoxes(): void {
        // Clear any existing helpers
        this.hideAllBoundingBoxes();
        
        // Get all entities including ropes
        const allEntities = [
            ...this.level.entities,
            ...this.level.ropes
        ];
        
        // Create box helpers for each entity
        allEntities.forEach(entity => {
            const mesh = entity.getCollisionMesh();
            if (!mesh) return;
            
            // Create a bounding box
            const box = new Box3().setFromObject(mesh);
            
            // Create a helper to visualize the box (with a green color)
            const helper = new Box3Helper(box, 0x00ff00);
            
            // Add the helper to the scene
            this.levelRenderer.scene.add(helper);
            
            // Save reference to the helper for removal later
            this.boundingBoxHelpers.push(helper);
        });
    }

    // Method to hide all bounding boxes
    private hideAllBoundingBoxes(): void {
        // Remove all existing helpers from the scene
        this.boundingBoxHelpers.forEach(helper => {
            this.levelRenderer.scene.remove(helper);
        });
        
        // Clear the array
        this.boundingBoxHelpers = [];
    }

    /**
     * Toggle between edit mode and test mode
     */
    private toggleTestMode(): void {
        if (this.inTestMode) {
            // Switch back to editor mode
            this.exitTestMode();
        } else {
            // Switch to test mode
            this.enterTestMode();
        }
    }

    /**
     * Enter test mode - spawns player and switches camera
     */
    private enterTestMode(): void {
        // Update the flag
        this.inTestMode = true;
        
        // Get player start position from marker if it exists
        const playerStartMarker = this.levelRenderer.scene.children.find(
            obj => obj.name === "player_start_position" || (obj.userData && obj.userData.isPlayerStart)
        ) as THREE.Mesh;
        
        if (playerStartMarker) {
            this.level.playerStartPosition = playerStartMarker.position.clone();
        }
        
        // Switch camera to third-person
        this.levelRenderer.camera.setMode(CameraMode.THIRD_PERSON);
        
        // Spawn player at start position
        const player = this.level.addPlayer('local-player', true);
        player.setPosition(this.level.playerStartPosition.clone());
        // this.levelRenderer.scene.add(player.getCollisionMesh());
        
        // Enable physics
        this.game.doLevelUpdate = true;
        
        // Change test button text
        const testButton = document.querySelector('button') as HTMLButtonElement;
        if (testButton && testButton.textContent === 'Test Level') {
            testButton.textContent = 'Exit Test Mode';
            testButton.style.backgroundColor = '#FF4444'; // Red for exit
        }
        
        console.log("Entered test mode");
    }

    /**
     * Exit test mode - removes player and restores editor camera
     */
    private exitTestMode(): void {
        // Update the flag
        this.inTestMode = false;
        
        // Remove player
        if (this.level.localPlayer) {
            const playerId = this.level.localPlayer.id;
            this.level.removePlayer(playerId);
        }
        
        // Disable physics
        this.game.doLevelUpdate = false;
        
        // Switch camera back to flying mode
        this.levelRenderer.camera.setMode(CameraMode.FIRST_PERSON_FLYING);
        
        // Change test button text back
        const testButton = document.querySelector('button') as HTMLButtonElement;
        if (testButton && testButton.textContent === 'Exit Test Mode') {
            testButton.textContent = 'Test Level';
            testButton.style.backgroundColor = '#9933CC'; // Purple for test
        }
        
        console.log("Exited test mode");
    }

    /**
     * Add a new saw at the camera's position
     */
    private addSaw(): void {
        // Get position for the new saw
        const sawPos = this.getPlacePosition(10, -1);
        
        const saw = Saw.create(
            sawPos,
            4.0,
            1.0, // default thickness
            0.1  // default spin speed
        );
        this.level.addSaw(saw);
        this.selectObject(saw.getCollisionMesh());
        console.log(`Added new saw at position ${sawPos.x.toFixed(2)}, ${sawPos.y.toFixed(2)}, ${sawPos.z.toFixed(2)}`);
    }

    /**
     * Add a new action area at the camera's position
     */
    private addActionArea(): void {
        // Get position for the new action area
        const areaPos = this.getPlacePosition(10, -1);
        
        // Default size for action area - make it larger by default for visibility
        const size = new THREE.Vector3(8, 8, 8);
        
        // Create a placeholder callback that just logs to console
        const placeholderCallback = () => {
            console.log("Action area triggered (placeholder)");
        };
        
        const actionArea = this.level.addActionArea(areaPos, size, placeholderCallback, false);
        
        // Add the action area to the levelRenderer such that it can be selected in the editor
        this.levelRenderer.scene.add(actionArea.getCollisionMesh());
        
        console.log(`Added new action area at position ${areaPos.x.toFixed(2)}, ${areaPos.y.toFixed(2)}, ${areaPos.z.toFixed(2)}`);

        // Update bounding boxes if they're visible to immediately show the new action area
        if (this.showBoundingBoxes) {
            this.showAllBoundingBoxes();
        }
    }
}


