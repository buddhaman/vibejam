import * as THREE from 'three';

import { Level } from './Level';
import { StaticBody } from './StaticBody';
import { RigidBody } from './RigidBody';
import { Game } from './Game';
import { LevelBuilder } from './LevelBuilder';

export class BeginnerLevels {
    /**
     * Creates a tutorial level for beginners to learn basic mechanics
     * @param level The Level instance to add level elements to
     * @param game The Game instance for level switching
     */
    public static createTutorialLevel(level: Level, game: Game): void {
        // Create a level builder instance starting at the origin
        const builder = new LevelBuilder(level);
        
        // STARTING PLATFORM
        // ================
        builder.createPlatformHere(15, 2, 15, LevelBuilder.MAIN_PLATFORM_MATERIAL, "tutorial-start-platform");
        
        // Initial tutorial text
        builder.addTextHere("BEGINNER TUTORIAL", 8, "white", "#000000")
               .addTextHere("Use WASD to move and SPACE to jump", 6, "#ffff00", "#000000");
        
        // BASIC JUMPING SECTION
        // ====================
        
        // Set direction for the jumping platforms (positive X axis)
        builder.setDirection(0);
        
        // Move ahead to the first jump platform position
        builder.moveForward(12);
        
        // First platform
        builder.createPlatformHere(8, 2, 8, LevelBuilder.MAIN_PLATFORM_MATERIAL, "jump-platform-0");
        builder.addTextHere("JUMP ACROSS PLATFORMS", 6, "white", "#000000");
        
        // Second platform - slight turn and higher
        builder.moveForward(10)
               .turn(Math.PI/12)  // Slight turn to the right
               .moveUp(0.5);
        builder.createPlatformHere(8, 2, 8, LevelBuilder.MAIN_PLATFORM_MATERIAL, "jump-platform-1");
        
        // Third platform - back to straight but slightly higher
        builder.moveForward(10)
               .turn(-Math.PI/12)  // Back to original direction
               .moveUp(0.5);
        builder.createPlatformHere(8, 2, 8, LevelBuilder.MAIN_PLATFORM_MATERIAL, "jump-platform-2");
        
        // Fourth platform - end of jumping section
        builder.moveForward(10)
               .moveRight(-2)  // Slight offset to left
               .moveUp(0.5);
        builder.createPlatformHere(10, 2, 10, LevelBuilder.MAIN_PLATFORM_MATERIAL, "jump-platform-3");
        
        // Save position for continuing to stairs section
        const jumpSectionEnd = builder.getPosition();
        
        // STAIRS SECTION
        // =============
        
        // Reset position and set direction to the stairs section
        builder.setPosition(jumpSectionEnd)
               .setDirection(Math.PI/6); // Turn slightly towards positive Z
        
        // Create a series of stairs
        for (let i = 0; i < 6; i++) {
            builder.moveForward(8)
                   .moveUp(3);
            builder.createPlatformHere(8, 2, 12, LevelBuilder.MAIN_PLATFORM_MATERIAL, `stair-platform-${i}`);
            
            // Add text at the start of stairs
            if (i === 0) {
                builder.addTextHere("CLIMB THE STAIRS", 7, "white", "#000000");
            }
        }
        
        // Save position for rope section
        const stairsTop = builder.getPosition();
        
        // ROPE SWINGING SECTION
        // ====================
        
        // Starting platform for rope section
        builder.setPosition(stairsTop);
        builder.createPlatformHere(12, 2, 12, LevelBuilder.MAIN_PLATFORM_MATERIAL, "rope-start-platform");
        
        // Add rope swinging instructions
        builder.addTextHere("SWING ON ROPES TO REACH THE FINAL PLATFORM", 7, "white", "#000000")
               .addTextHere("JUMP INTO ROPES TO GRAB THEM", 5, "#ffff00", "#000000")
               .addTextHere("PRESS CTRL TO CROUCH AND RELEASE ROPE", 2, "#ffff00", "#000000");
        
        // Add first rope
        builder.moveForward(15);
        builder.addRopeHere(17, 12, 18, 0.3, 0x22ff22);
        
        // Move forward and down for second rope
        builder.moveForward(15);
        builder.addRopeHere(17, 12, 18, 0.3, 0x22ff22);
        
        // Move forward and down for final platform
        builder.moveForward(15)
               .moveDown(3); // Lower than rope anchor platform
        
        // Create final platform
        builder.createPlatformHere(15, 2, 15, LevelBuilder.MAIN_PLATFORM_MATERIAL, "final-platform");
        
        // Add portal and congratulatory text
        builder.addTextHere("CONGRATULATIONS!", 10, "#ffff00", "#000000")
               .addTextHere("RETURN TO OVERWORLD", 8, "white", "#000000");
        
        // Move to center of platform for portal placement
        builder.moveForward(0); // Reset forward direction
        builder.moveRight(0); // Reset to center of platform
        
        // Add portal back to overworld
        builder.addPortalHere(
            3, 6, 
            LevelBuilder.PORTAL_MATERIAL,
            "portal-overworld",
            () => {
                console.log("Returning to Overworld");
                if (game) {
                    game.switchLevel(0);  // 0 represents the overworld
                }
            }
        );
        
        // Position player at start
        level.localPlayer?.setPosition(new THREE.Vector3(0, 5, 0));
    }
}
