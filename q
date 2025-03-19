[1mdiff --git a/client/src/Game.ts b/client/src/Game.ts[m
[1mindex ea23460..3079f40 100644[m
[1m--- a/client/src/Game.ts[m
[1m+++ b/client/src/Game.ts[m
[36m@@ -3,6 +3,7 @@[m [mimport { Player } from './Player';[m
 import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';[m
 import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';[m
 import { StaticBody } from './StaticBody';[m
[32m+[m[32mimport { Input, InputState } from './Input';[m
 [m
 export class Game {[m
     public scene: THREE.Scene;[m
[36m@@ -32,6 +33,8 @@[m [mexport class Game {[m
     // Add this property to the Game class[m
     public inputKeys: { [key: string]: boolean } = {};[m
 [m
[32m+[m[32m    private input: Input;[m
[32m+[m
     constructor() {[m
         this.scene = new THREE.Scene();[m
         this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);[m
[36m@@ -59,6 +62,8 @@[m [mexport class Game {[m
         [m
         // Add a single test box for collision[m
         this.createTestBox();[m
[32m+[m
[32m+[m[32m        this.input = new Input();[m
     }[m
 [m
     /**[m
[36m@@ -416,16 +421,8 @@[m [mexport class Game {[m
             this.cameraDistance = Math.max(4, Math.min(20, this.cameraDistance + event.deltaY * 0.01));[m
         });[m
 [m
[31m-        // Set up keyboard input tracking (only track state, don't update player here)[m
[31m-        this.inputKeys = {};[m
[31m-        [m
[31m-        window.addEventListener('keydown', (event) => {[m
[31m-            this.inputKeys[event.key.toLowerCase()] = true;[m
[31m-        });[m
[31m-        [m
[31m-        window.addEventListener('keyup', (event) => {[m
[31m-            this.inputKeys[event.key.toLowerCase()] = false;[m
[31m-        });[m
[32m+[m[32m        // No need to manually track keyboard input anymore[m
[32m+[m[32m        // The Input class handles this internally[m
 [m
         // Add shadow toggle[m
         window.addEventListener('keydown', (event) => {[m
[36m@@ -565,19 +562,15 @@[m [mexport class Game {[m
         // Calculate the forward vector using cameraPhi and cameraTheta[m
         const forwardX = -Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);[m
         const forwardZ = -Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);[m
[32m+[m[32m        const forwardVector = new THREE.Vector3(forwardX, 0, forwardZ).normalize();[m
 [m
[31m-        // Update the local player's forward vector[m
[32m+[m[32m        // Update the local player's forward vector and handle input[m
         if (this.localPlayer) {[m
[31m-            this.localPlayer.forward.set(forwardX, 0, forwardZ).normalize();[m
[32m+[m[32m            this.localPlayer.forward.copy(forwardVector);[m
             [m
[31m-            this.localPlayer.handleInput({[m
[31m-                w: this.inputKeys['w'] || false,[m
[31m-                a: this.inputKeys['a'] || false,[m
[31m-                s: this.inputKeys['s'] || false,[m
[31m-                d: this.inputKeys['d'] || false,[m
[31m-                space: this.inputKeys[' '] || false,[m
[31m-                shift: this.inputKeys['shift'] || false[m
[31m-            });[m
[32m+[m[32m            // Get input state and pass to player[m
[32m+[m[32m            const inputState = this.input.getInputState();[m
[32m+[m[32m            this.localPlayer.handleInput(inputState, forwardVector);[m
         }[m
 [m
         // Update all players[m
[1mdiff --git a/client/src/Player.ts b/client/src/Player.ts[m
[1mindex 914168f..622918d 100644[m
[1m--- a/client/src/Player.ts[m
[1m+++ b/client/src/Player.ts[m
[36m@@ -1,5 +1,6 @@[m
 import * as THREE from 'three';[m
 import { Verlet, VerletBody } from '../../shared/Verlet';[m
[32m+[m[32mimport {InputAction, InputState } from './Input';[m
 [m
 export class Player {[m
     public id: string;[m
[36m@@ -230,19 +231,25 @@[m [mexport class Player {[m
         cylinder.quaternion.copy(quaternion);[m
     }[m
 [m
[31m-    public handleInput(input: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift?: boolean }): void {[m
[31m-        this.isMoving = input.w || input.a || input.s || input.d || input.space || !!input.shift;[m
[32m+[m[32m    public handleInput(inputState: InputState, forwardDir: THREE.Vector3): void {[m
[32m+[m[32m        // Update isMoving state[m
[32m+[m[32m        this.isMoving = inputState[InputAction.FORWARD] ||[m[41m [m
[32m+[m[32m                       inputState[InputAction.BACKWARD] ||[m[41m [m
[32m+[m[32m                       inputState[InputAction.LEFT] ||[m[41m [m
[32m+[m[32m                       inputState[InputAction.RIGHT] ||[m[41m [m
[32m+[m[32m                       inputState[InputAction.JUMP] ||[m[41m [m
[32m+[m[32m                       inputState[InputAction.CROUCH];[m
 [m
[31m-        // Calculate the perpendicular vector for left/right movement[m
[32m+[m[32m        // Calculate movement direction[m
         const upVector = new THREE.Vector3(0, 1, 0);[m
[31m-        const rightVector = new THREE.Vector3().crossVectors(this.forward, upVector).normalize();[m
[32m+[m[32m        const rightVector = new THREE.Vector3().crossVectors(forwardDir, upVector).normalize();[m
 [m
         // Create a single movement direction vector based on input[m
         const movementDir = new THREE.Vector3(0, 0, 0);[m
[31m-        if (input.w) movementDir.add(this.forward);[m
[31m-        if (input.s) movementDir.sub(this.forward);[m
[31m-        if (input.a) movementDir.sub(rightVector);[m
[31m-        if (input.d) movementDir.add(rightVector);[m
[32m+[m[32m        if (inputState[InputAction.FORWARD]) movementDir.add(forwardDir);[m
[32m+[m[32m        if (inputState[InputAction.BACKWARD]) movementDir.sub(forwardDir);[m
[32m+[m[32m        if (inputState[InputAction.LEFT]) movementDir.sub(rightVector);[m
[32m+[m[32m        if (inputState[InputAction.RIGHT]) movementDir.add(rightVector);[m
         [m
         // Only normalize if there's movement[m
         if (movementDir.lengthSq() > 0) {[m
[36m@@ -266,11 +273,12 @@[m [mexport class Player {[m
             }[m
         });[m
 [m
[31m-        // Find most forward and backward particles in the movement direction[m
[31m-        let mostForwardParticle = particles[0];[m
[31m-        let mostBackwardParticle = particles[0];[m
[31m-        [m
[32m+[m[32m        // Process movement if there's a direction[m
         if (movementDir.lengthSq() > 0) {[m
[32m+[m[32m            // Find most forward and backward particles in the movement direction[m
[32m+[m[32m            let mostForwardParticle = particles[0];[m
[32m+[m[32m            let mostBackwardParticle = particles[0];[m
[32m+[m[41m            [m
             particles.forEach(particle => {[m
                 const dirDistance = particle.position.dot(movementDir);[m
                 if (dirDistance > mostForwardParticle.position.dot(movementDir)) {[m
[36m@@ -294,16 +302,16 @@[m [mexport class Player {[m
             mostBackwardParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));[m
         }[m
         [m
[31m-        // Handle spacebar action - apply equal and opposite forces[m
[31m-        if (input.space) {[m
[32m+[m[32m        // Handle jump action - apply equal and opposite forces[m
[32m+[m[32m        if (inputState[InputAction.JUMP]) {[m
             // Apply equal and opposite forces (net force = 0)[m
             const stretchForce = 0.8; // Adjust this value for desired stretch amount[m
             highestParticle.applyImpulse(new THREE.Vector3(0, stretchForce, 0));[m
             lowestParticle.applyImpulse(new THREE.Vector3(0, -stretchForce, 0));[m
         }[m
         [m
[31m-        // Handle shift action - squeeze (opposite of stretch)[m
[31m-        if (input.shift) {[m
[32m+[m[32m        // Handle crouch action - squeeze (opposite of stretch)[m
[32m+[m[32m        if (inputState[InputAction.CROUCH]) {[m
             const squeezeForce = 0.2;[m
             highestParticle.applyImpulse(new THREE.Vector3(0, -squeezeForce, 0));[m
             lowestParticle.applyImpulse(new THREE.Vector3(0, squeezeForce, 0));[m
