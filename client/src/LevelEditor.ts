import * as THREE from 'three';
import { Game } from "./Game";
import { Level } from "./Level";
import { LevelRenderer } from './LevelRenderer';
import { CameraMode } from './Camera';
import { LevelBuilder } from './LevelBuilder';

export class LevelEditor {
    private game: Game;
    private level: Level;
    private levelRenderer: LevelRenderer;

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

        LevelBuilder.createHorizontalPlatform(this.level, 
            new THREE.Vector3(20, 0, 0), 
            10, 
            10, 
            1, 
            new THREE.MeshBasicMaterial({ color: 0x00ff00 }), 
            "horizontal_platform");

        // Set camera to first-person flying mode for the editor
        this.levelRenderer.camera.setMode(CameraMode.FIRST_PERSON_FLYING);
        
        // Set document title
        document.title = "Level Editor - 3D Platformer";
        
        // Basic setup to render an empty level
        this.setup();
    }

    /**
     * Setup the editor environment
     */
    private setup(): void {
        // Add a simple indicator that we're in editor mode
        this.addEditorLabel();
    }

    /**
     * Add editor label to clearly show we're in editor mode
     */
    private addEditorLabel(): void {
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
        helpText.textContent = "Editor Controls: WASD = Move, Space = Up, Shift = Down, Alt/Ctrl = Sprint";
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
    }
}


