
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, Suspense, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus } from '../../types';
import { audio } from '../System/Audio';

const FIRE_RATE = 0.15; // Seconds between shots

// --- CONFIGURATION ---
// Set to true to attempt loading the external GLB model.
// Ensure the file exists at the path or URL before enabling to avoid 404 errors.
const ENABLE_CUSTOM_MODEL = true; 

// --- PATH CONSTANTS ---
const REMOTE_PATH = 'https://raw.githubusercontent.com/Lexus74/Gemini-Hunter/main/public/assets/models/Hunter.glb';
const LOCAL_PATH = '/assets/models/Hunter.glb';

// --- ERROR BOUNDARY ---
// Catches 404s/Fetch errors from useGLTF
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }
  
  componentDidCatch(error: any) {
    // Suppress console error spam for known missing assets if handled
    // console.warn("Model failed to load, switching to fallback.", error);
  }
  
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// --- Procedural Mech Character (Fallback) ---
const MechModel: React.FC<{ isSlowMotion: boolean }> = ({ isSlowMotion }) => {
    const group = useRef<THREE.Group>(null);
    const leftLeg = useRef<THREE.Group>(null);
    const rightLeg = useRef<THREE.Group>(null);
    const leftArm = useRef<THREE.Group>(null);
    const rightArm = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!leftLeg.current || !rightLeg.current || !leftArm.current || !rightArm.current) return;
        
        const t = state.clock.elapsedTime;
        const baseSpeed = 15;
        const speed = isSlowMotion ? baseSpeed * 0.5 : baseSpeed; 
        
        // Leg Animation (Walking)
        const legAmp = 0.6;
        leftLeg.current.rotation.x = Math.sin(t * speed) * legAmp;
        rightLeg.current.rotation.x = Math.sin(t * speed + Math.PI) * legAmp;
        
        // Arm Animation
        const armAmp = 0.3;
        
        // Left Arm: Natural Swing
        leftArm.current.rotation.x = Math.sin(t * speed + Math.PI) * armAmp;
        
        // Right Arm: HOLD GUN (Pointing Forward)
        // Fixed -90 degrees (pointing forward) + slight recoil/bob
        rightArm.current.rotation.x = -Math.PI / 2 + (Math.sin(t * speed * 2) * 0.05);
    });

    return (
        <group ref={group}>
            {/* Torso */}
            <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.5, 0.6, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.8} />
            </mesh>
            {/* Chest Light */}
            <mesh position={[0, 1.2, 0.16]}>
                <circleGeometry args={[0.12, 32]} />
                <meshBasicMaterial color="#00ffff" toneMapped={false} />
            </mesh>
            <pointLight position={[0, 1.2, 0.3]} distance={1} intensity={2} color="#00ffff" />
            
            {/* Head */}
            <group position={[0, 1.55, 0]}>
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.3, 0.3, 0.35]} />
                    <meshStandardMaterial color="#333" roughness={0.3} metalness={0.8} />
                </mesh>
                <mesh position={[0, 0.02, 0.18]}>
                    <planeGeometry args={[0.25, 0.1]} />
                    <meshBasicMaterial color="#ff0055" toneMapped={false} />
                </mesh>
                <mesh position={[0.1, 0.2, -0.1]}>
                    <cylinderGeometry args={[0.01, 0.01, 0.3]} />
                    <meshStandardMaterial color="#888" />
                </mesh>
            </group>

            {/* Jetpack */}
            <group position={[0, 1.2, -0.2]}>
                <mesh castShadow>
                     <boxGeometry args={[0.4, 0.5, 0.15]} />
                     <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[-0.1, -0.25, 0]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[0.08, 0.3, 8]} />
                    <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
                </mesh>
                <mesh position={[0.1, -0.25, 0]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[0.08, 0.3, 8]} />
                    <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
                </mesh>
            </group>

            {/* Left Arm */}
            <group ref={leftArm} position={[-0.35, 1.35, 0]}>
                <mesh position={[0, -0.3, 0]} castShadow>
                    <boxGeometry args={[0.15, 0.6, 0.15]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                <mesh position={[0, -0.65, 0]} castShadow>
                     <sphereGeometry args={[0.1]} />
                     <meshStandardMaterial color="#222" />
                </mesh>
            </group>

            {/* Right Arm (With Gun) */}
            <group ref={rightArm} position={[0.35, 1.35, 0]}>
                {/* Arm Segment */}
                <mesh position={[0, -0.3, 0]} castShadow>
                    <boxGeometry args={[0.15, 0.6, 0.15]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                
                {/* Gun Assembly attached to hand */}
                <group position={[0, -0.6, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                     <mesh castShadow>
                         <cylinderGeometry args={[0.06, 0.08, 0.5]} />
                         <meshStandardMaterial color="#111" />
                     </mesh>
                     {/* Barrel Glow */}
                     <mesh position={[0, 0.26, 0]}>
                         <cylinderGeometry args={[0.04, 0.04, 0.05]} />
                         <meshBasicMaterial color="#00ffff" />
                     </mesh>
                </group>
            </group>

            {/* Legs */}
            <group ref={leftLeg} position={[-0.2, 0.8, 0]}>
                <mesh position={[0, -0.4, 0]} castShadow>
                    <boxGeometry args={[0.18, 0.8, 0.2]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[0, -0.2, 0.11]}>
                    <boxGeometry args={[0.12, 0.15, 0.05]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
            </group>
            <group ref={rightLeg} position={[0.2, 0.8, 0]}>
                <mesh position={[0, -0.4, 0]} castShadow>
                    <boxGeometry args={[0.18, 0.8, 0.2]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                 <mesh position={[0, -0.2, 0.11]}>
                    <boxGeometry args={[0.12, 0.15, 0.05]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
            </group>
        </group>
    );
};

// --- Generic GLB Asset Loader ---
const LoadedModel: React.FC<{ url: string, isSlowMotion: boolean }> = ({ url, isSlowMotion }) => {
    const { scene, animations } = useGLTF(url) as any;
    const { actions } = useAnimations(animations, scene);

    useEffect(() => {
        if (scene) {
            scene.traverse((child: any) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
    }, [scene]);

    // Animation Selection Logic
    useEffect(() => {
        if (actions) {
            const actionKeys = Object.keys(actions);
            if (actionKeys.length > 0) {
                // Try to find a 'Run' or 'Walk' animation, otherwise default to first
                const runKey = actionKeys.find(key => key.toLowerCase().includes('run') || key.toLowerCase().includes('walk') || key.toLowerCase().includes('sprint'));
                const keyToPlay = runKey || actionKeys[0];
                
                const action = actions[keyToPlay];
                if(action) {
                    action.reset().fadeIn(0.5).play();
                }
            }
        }
    }, [actions]);

    useEffect(() => {
        if (actions) {
            Object.values(actions).forEach((action: any) => {
                if (action) {
                     // Reduced speed to simulate walking
                     action.timeScale = isSlowMotion ? 0.25 : 0.6; // Slightly faster walk
                }
            });
        }
    }, [isSlowMotion, actions]);

    // Facing Forward (Math.PI / 2) - Corrected rotation based on user feedback
    return <primitive object={scene} scale={[2.0, 2.0, 2.0]} position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]} />;
};


export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  
  const { status, laneCount, takeDamage, hasSpreadShot, triggerSlowMotion, isSlowMotion, isImmortalityActive } = useStore();
  
  const [lane, setLane] = useState(0);
  const targetX = useRef(0);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);

  // Auto-Fire State
  const isFiring = useRef(false);
  const lastFireTime = useRef(0);

  // --- Reset State on Game Start ---
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          if (groupRef.current) groupRef.current.position.y = 0;
          if (bodyRef.current) bodyRef.current.rotation.x = 0;
          isFiring.current = false;
      }
  }, [status]);
  
  // Safety: Clamp lane if laneCount changes
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      if (Math.abs(lane) > maxLane) {
          setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
      }
  }, [laneCount, lane]);

  // --- Controls ---
  const triggerCrouch = () => {
      triggerSlowMotion();
  };

  const triggerShoot = () => {
    audio.playShoot();
    
    // Dispatch event for LevelManager to handle spawning bullets
    if (groupRef.current) {
        const x = groupRef.current.position.x;
        // Adjusted spawn height to match the procedural Mech's gun arm height
        const y = groupRef.current.position.y + 1.2; 
        const z = groupRef.current.position.z;

        // Center Shot
        window.dispatchEvent(new CustomEvent('player-shoot', {
            detail: { x, y, z, angle: 0 }
        }));

        if (hasSpreadShot) {
            // Left Angled Shot
            window.dispatchEvent(new CustomEvent('player-shoot', {
                detail: { x, y, z, angle: -0.2 } // Slight angle in radians
            }));
             // Right Angled Shot
             window.dispatchEvent(new CustomEvent('player-shoot', {
                detail: { x, y, z, angle: 0.2 }
            }));
        }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const maxLane = Math.floor(laneCount / 2);

      // Steering
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          setLane(l => Math.max(l - 1, -maxLane));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          setLane(l => Math.min(l + 1, maxLane));
      } 
      // Crouch / Slow Motion
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          triggerCrouch();
      } 
      // Shoot (Hold)
      else if (e.key === ' ' || e.key === 'Enter') {
          isFiring.current = true;
      } 
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
            isFiring.current = false;
        }
    };

    const handleMouseDown = (e: MouseEvent) => {
        if (status !== GameStatus.PLAYING) return;
        if (e.button === 0) {
            isFiring.current = true;
        }
    };

    const handleMouseUp = () => {
        isFiring.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [status, laneCount, hasSpreadShot]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isFiring.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        isFiring.current = false; // Stop firing on lift

        // Swipe Detection
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 30) {
            // Swipe Down for Crouch
            triggerCrouch();
        }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount]);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    const time = state.clock.elapsedTime;

    // AUTO FIRE LOGIC
    if (isFiring.current) {
        if (time > lastFireTime.current + FIRE_RATE) {
            triggerShoot();
            lastFireTime.current = time;
        }
    }

    // 1. Horizontal Position
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current, 
        delta * 15 
    );

    // 2. Banking Rotation
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2; 
    
    // 3. Vertical Bobbing / Leaning
    const hoverFreq = 4;
    const swayX = Math.sin(time * 2.5) * 0.03;

    if (bodyRef.current) {
        // Base Rotation: Lean forward slightly (0.1), lean more if SlowMotion (0.3)
        // Procedural model is already built upright, so we just add the lean.
        const baseLean = isSlowMotion ? 0.3 : 0.1;
        
        // Procedural model faces +Z by default (geometry construction), 
        // but game logic often assumes looking down -Z.
        // We actually want the model to face away from camera (-Z).
        // Since we build the mesh "facing front", we likely need to rotate Y by PI to face away if using standard front-facing geometry.
        // But our Mesh construction is symmetric or implicitly built. Let's assume standard Y rotation logic.
        
        bodyRef.current.rotation.y = Math.PI + swayX; 
        bodyRef.current.rotation.x = baseLean;
        
        // Bobbing
        const bounce = Math.abs(Math.sin(time * 10)) * 0.1; // Running bounce
        bodyRef.current.position.y = bounce;
    }

    // 4. Invincibility Effect
    const showFlicker = isInvincible.current || isImmortalityActive;
    if (showFlicker) {
        if (isInvincible.current) {
             if (Date.now() - lastDamageTime.current > 1500) {
                isInvincible.current = false;
                groupRef.current.visible = true;
             } else {
                groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
             }
        } 
        if (isImmortalityActive) {
            groupRef.current.visible = true; 
        }
    } else {
        groupRef.current.visible = true;
    }
  });

  // Damage Handler
  useEffect(() => {
     const checkHit = (e: any) => {
        if (isInvincible.current || isImmortalityActive) return;
        audio.playDamage(); 
        takeDamage();
        isInvincible.current = true;
        lastDamageTime.current = Date.now();
     };
     window.addEventListener('player-hit', checkHit);
     return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive]);

  // --- Fallback Rendering Logic ---
  // Try Remote -> Try Local -> Use Procedural
  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={bodyRef}>
          {ENABLE_CUSTOM_MODEL ? (
              <ModelErrorBoundary fallback={
                   // Level 2: Try Local File
                   <ModelErrorBoundary fallback={
                        // Level 3: Fallback to Procedural Code
                        <MechModel isSlowMotion={isSlowMotion} />
                   }>
                        <Suspense fallback={<MechModel isSlowMotion={isSlowMotion} />}>
                            <LoadedModel url={LOCAL_PATH} isSlowMotion={isSlowMotion} />
                        </Suspense>
                   </ModelErrorBoundary>
              }>
                   {/* Level 1: Try Remote URL */}
                   <Suspense fallback={<MechModel isSlowMotion={isSlowMotion} />}>
                       <LoadedModel url={REMOTE_PATH} isSlowMotion={isSlowMotion} />
                   </Suspense>
              </ModelErrorBoundary>
          ) : (
              <MechModel isSlowMotion={isSlowMotion} />
          )}
      </group>
      
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#000000" opacity={0.5} transparent />
      </mesh>
    </group>
  );
};
