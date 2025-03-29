import * as THREE from 'three';
import { Game } from "./Game";
import { Level } from "./Level";
import { LevelRenderer } from './LevelRenderer';
import { CameraMode } from './Camera';
import { LevelBuilder } from './LevelBuilder';
import { ConvexShape } from '../../shared/ConvexShape';
import { RigidBody } from './RigidBody';
import { StaticBody } from './StaticBody';

export class LevelEditor {
    private game: Game;
    private level: Level;
    private levelRenderer: LevelRenderer;
    
    // Selection handling
    private selectedObject: THREE.Object3D | null = null;
    private transformControls: THREE.TransformControls | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private isDragging: boolean = false;

    // New property
    private platforms: any[] = [];

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
        this.level = new Level(this.game, -1); // Use -1 to indicate editor mode
        this.levelRenderer = this.game.levelRenderer!;
        this.level.levelRenderer = this.levelRenderer;

        // Add a ground platform to start with
        LevelBuilder.createHorizontalPlatform(this.level, 
            new THREE.Vector3(0, -2, 0), 
            50, 
            50, 
            1, 
            new THREE.MeshStandardMaterial({ 
                color: 0x888888,
                roughness: 0.8,
            }), 
            "ground_platform");

        // Set camera to first-person flying mode for the editor
        this.levelRenderer.camera.setMode(CameraMode.FIRST_PERSON_FLYING);
        
        // Set document title
        document.title = "Level Editor - 3D Platformer";
        
        // Setup UI and controls
        this.setupEditorUI();
        this.createTransformPanel();
        this.setupSelectionControls();
    }

    /**
     * Set up the editor UI components
     */
    private setupEditorUI(): void {
        // Add editor label
        const infoLabel = document.createElement('div');
        infoLabel.textContent = "LEVEL EDITOR MODE";
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
        
        // Add delete button 
        const deleteBtn = this.createButton('Delete Selected', () => this.deleteSelected());
        toolbar.appendChild(deleteBtn);
        
        // Add Save/Load buttons
        const saveBtn = this.createButton('Save Level', () => this.saveLevel());
        toolbar.appendChild(saveBtn);
        
        const loadBtn = this.createButton('Load Level', () => this.loadLevel());
        toolbar.appendChild(loadBtn);
        
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
        
        button.addEventListener('click', onClick);
        
        return button;
    }
    
    /**
     * Set up selection and transformation controls
     */
    private setupSelectionControls(): void {
        import('three/examples/jsm/controls/TransformControls').then(({ TransformControls }) => {
            // Create transform controls
            this.transformControls = new TransformControls(
                this.levelRenderer.camera.threeCamera, 
                this.levelRenderer.renderer.domElement
            );
            
            // Add to scene
            this.levelRenderer.scene.add(this.transformControls);
            
            // Set up events for the transform controls
            this.setupTransformControlsEvents();
            
            // Add event listener to handle transform mode changes
            window.addEventListener('keydown', (event) => {
                if (!this.selectedObject) return;
                
                switch (event.key.toLowerCase()) {
                    case 'g': // Move (grab)
                        this.transformControls!.setMode('translate');
                        break;
                    case 'r': // Rotate
                        this.transformControls!.setMode('rotate');
                        break;
                    case 's': // Scale
                        this.transformControls!.setMode('scale');
                        break;
                    case 'delete': // Delete selected object
                    case 'backspace':
                        this.deleteSelected();
                        break;
                }
            });
            
            // Make transform controls disable camera controls while dragging
            this.transformControls.addEventListener('dragging-changed', (event) => {
                this.isDragging = event.value;
            });
        });
        
        // Add click event listener for selection
        const canvas = this.levelRenderer.renderer.domElement;
        canvas.addEventListener('click', (event) => {
            // Skip if we're dragging with transform controls
            if (this.isDragging) return;
            
            // Calculate mouse position in normalized device coordinates
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // Raycast to find intersected objects
            this.raycaster.setFromCamera(this.mouse, this.levelRenderer.camera.threeCamera);
            
            // Find all platforms in the scene
            const platforms = this.platforms.map(p => p.mesh);
            
            // Check for intersections
            const intersects = this.raycaster.intersectObjects(platforms, false);
            
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
     * Add a new platform at the camera's position
     */
    private addPlatform(): void {
        // Get camera position and forward direction
        const cameraPos = this.levelRenderer.camera.getPosition();
        const forwardDir = this.levelRenderer.camera.getForwardVector();
        
        // Position the platform 10 units in front of the camera
        const platformPos = cameraPos.clone().add(forwardDir.multiplyScalar(10));
        platformPos.y -= 1; // Slightly below camera view for better visibility
        
        // Create a random color
        const color = new THREE.Color(Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5);
        
        // Platform name
        const platformName = `platform_${Date.now()}`;
        
        // Use LevelBuilder but DO NOT add it to the scene through standard channels
        // This creates a box with correct dimensions but we'll handle positioning manually
        const platform = LevelBuilder.createHorizontalPlatform(
            this.level,
            new THREE.Vector3(0, 0, 0), // Create at origin first
            5, // width
            5, // depth
            1, // height
            new THREE.MeshStandardMaterial({ 
                color: color,
                roughness: 0.7,
            }),
            platformName
        );
        
        // Now set the shape's position without updating the mesh
        if (platform && platform.shape) {
            // Set the shape's position to our desired world position
            platform.shape.position.copy(platformPos);
            
            // Now update the transform which will cascade to the mesh
            platform.shape.updateTransform();
            
            // Add to our platforms array
            this.platforms.push(platform);
            
            // Add to scene if needed (depends on what LevelBuilder does)
            if (!platform.mesh.parent) {
                this.levelRenderer.scene.add(platform.mesh);
            }
            
            // Select the new platform
            this.selectObject(platform.mesh);
        }
        
        console.log(`Added new platform: ${platformName}`);
    }
    
    /**
     * Delete the currently selected object
     */
    private deleteSelected(): void {
        if (!this.selectedObject) return;
        
        // Find which platform this is
        const platformIndex = this.platforms.findIndex(p => p.mesh === this.selectedObject);
        
        if (platformIndex >= 0) {
            // Get the platform
            const platform = this.platforms[platformIndex];
            
            // Remove from scene
            platform.removeFromScene(this.levelRenderer.scene);
            
            // Remove from level data
            this.platforms.splice(platformIndex, 1);
            
            console.log(`Deleted platform: ${platform.mesh.name || 'Unnamed Platform'}`);
            
            // Deselect
            this.deselectObject();
        }
    }
    
    /**
     * Save the current level to JSON
     */
    private saveLevel(): void {
        // Create level data object
        const levelData = {
            platforms: this.platforms.map(platform => ({
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
            metadata: {
                created: new Date().toISOString(),
                name: 'Custom Level'
            }
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(levelData, null, 2);
        
        // Create download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'level.json';
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        console.log('Level saved to JSON');
    }
    
    /**
     * Load a level from JSON file
     */
    private loadLevel(): void {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        // Handle file selection
        fileInput.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            // Read the file
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const levelData = JSON.parse(content);
                    
                    // Clear existing level
                    this.clearLevel();
                    
                    // Load platforms
                    if (levelData.platforms && Array.isArray(levelData.platforms)) {
                        levelData.platforms.forEach((platformData: any) => {
                            // Extract platform data
                            const position = new THREE.Vector3(
                                platformData.position[0],
                                platformData.position[1],
                                platformData.position[2]
                            );
                            
                            // Create color from hex string or use default
                            let color;
                            try {
                                color = new THREE.Color(platformData.color || '#888888');
                            } catch (e) {
                                color = new THREE.Color(0x888888);
                            }
                            
                            // Create the platform
                            const width = platformData.scale ? platformData.scale[0] : 5;
                            const depth = platformData.scale ? platformData.scale[2] : 5;
                            const height = platformData.scale ? platformData.scale[1] : 1;
                            
                            const platform = LevelBuilder.createHorizontalPlatform(
                                this.level,
                                position,
                                width,
                                depth,
                                height,
                                new THREE.MeshStandardMaterial({ 
                                    color: color,
                                    roughness: 0.7
                                }),
                                platformData.name || `platform_${Date.now()}`
                            );
                            
                            // Apply rotation if available
                            if (platformData.rotation && platform) {
                                platform.mesh.rotation.set(
                                    platformData.rotation[0],
                                    platformData.rotation[1],
                                    platformData.rotation[2]
                                );
                            }
                        });
                    }
                    
                    console.log('Level loaded from JSON');
                } catch (error) {
                    console.error('Error loading level:', error);
                }
            };
            
            reader.readAsText(file);
        };
        
        // Trigger file selection
        fileInput.click();
    }
    
    /**
     * Clear the current level
     */
    private clearLevel(): void {
        // Deselect any selected object
        this.deselectObject();
        
        // Remove all platforms from scene
        this.platforms.forEach(platform => {
            platform.removeFromScene(this.levelRenderer.scene);
        });
        
        // Clear platforms array
        this.platforms = [];
        
        // Add ground platform back
        LevelBuilder.createHorizontalPlatform(this.level, 
            new THREE.Vector3(0, -2, 0), 
            50, 
            50, 
            1, 
            new THREE.MeshStandardMaterial({ 
                color: 0x888888,
                roughness: 0.8,
            }), 
            "ground_platform");
    }

    private setupTransformControlsEvents(): void {
        if (!this.transformControls) return;
        
        // When object is transformed, update the underlying shape
        this.transformControls.addEventListener('objectChange', () => {
            if (this.selectedObject) {
                // Find the platform
                const platform = this.platforms.find(p => p.mesh === this.selectedObject);
                if (platform && platform.shape) {
                    // Update the shape's transform properties to match the mesh
                    platform.shape.position.copy(this.selectedObject.position);
                    platform.shape.orientation.copy(this.selectedObject.quaternion);
                    // Don't update scale unless you need to
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
            const platform = this.platforms.find(p => p.mesh === this.selectedObject);
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
}


