
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, useMemo, Suspense, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center, useGLTF, Clone } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, EnemyVariant, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS } from '../../types';
import { audio } from '../System/Audio';

// --- Assets ---
const ALIEN_PATHS = {
    [EnemyVariant.GREEN_ALIEN]: '/assets/models/Alien1.glb',
    [EnemyVariant.SAUCER]: '/assets/models/Alien2.glb',
    [EnemyVariant.ARMORED]: '/assets/models/Alien3.glb',
};

// --- Error Boundary for Models ---
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children?: ReactNode;
}

class ModelErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// --- Geometry Constants (Fallbacks) ---

// Green Alien (Level 1)
const ALIEN_GREEN_HEAD = new THREE.SphereGeometry(0.5, 16, 16);
const ALIEN_GREEN_EYE = new THREE.SphereGeometry(0.15, 8, 8);

// Saucer (Level 2)
const SAUCER_BODY = new THREE.CylinderGeometry(0.2, 0.7, 0.3, 16);
const SAUCER_DOME = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);

// Armored Alien (Level 3)
const ARMORED_BODY = new THREE.CylinderGeometry(0.4, 0.3, 0.6, 8);
const ARMORED_HEAD = new THREE.BoxGeometry(0.4, 0.35, 0.45);
const ARMORED_SHOULDER = new THREE.SphereGeometry(0.25, 8, 8);
const ARMORED_VISOR = new THREE.PlaneGeometry(0.3, 0.1);

const GEM_GEOMETRY = new THREE.IcosahedronGeometry(0.15, 0);

// Alien (The Shooter Flyer) Geometries
const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);

// Missile Geometries
const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);

// Bullet Geometry
const BULLET_GEO = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
const ENEMY_BULLET_GEO = new THREE.SphereGeometry(0.25, 8, 8);

// Shop Geometries
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1); 
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8); 

const PARTICLE_COUNT = 600;
const BASE_LETTER_INTERVAL = 150; 
const MISSILE_SPEED = 30; 
const BULLET_SPEED = 60;
const ENEMY_BULLET_SPEED = 20;

const getLetterInterval = (level: number) => {
    return BASE_LETTER_INTERVAL * Math.pow(1.5, Math.max(0, level - 1));
};

// Font for 3D Text
const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color } = e.detail;
            let spawned = 0;
            const burstAmount = 40; 

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = 2 + Math.random() * 10;
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};


const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

// --- Loaded Enemy Component ---
const LoadedEnemy: React.FC<{ url: string; scale: number }> = ({ url, scale }) => {
    const { scene } = useGLTF(url);
    // Clone scene for multiple instances
    // Rotation Math.PI assumes models face +Z (forward), so we rotate 180 to face camera
    return <Clone object={scene} scale={[scale * 1.5, scale * 1.5, scale * 1.5]} rotation={[0, Math.PI, 0]} />;
};

const GameEntity: React.FC<{ data: GameObject }> = ({ data }) => {
    const meshRef = useRef<THREE.Group>(null);
    const { type, position, color, value, variant, scale = 1.0 } = data;
    
    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.position.set(position[0], position[1], position[2]);
            
            if (type === ObjectType.GEM || type === ObjectType.LETTER) {
                meshRef.current.rotation.y += delta * 2;
                meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.1;
            } else if (type === ObjectType.MISSILE) {
                 meshRef.current.rotation.z += delta * 10;
            } else if (type === ObjectType.BARREL) {
                 // Slight bob for enemies
                 meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 5) * 0.1;
            }
        }
    });

    const innerContent = useMemo(() => {
         switch(type) {
             case ObjectType.LETTER:
                 return (
                     <group>
                        <Center top>
                            <Text3D font={FONT_URL} size={0.6} height={0.2} curveSegments={12}>
                                {value}
                                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                            </Text3D>
                        </Center>
                        <mesh rotation={[Math.PI/2,0,0]}>
                            <torusGeometry args={[0.5, 0.05, 16, 32]} />
                            <meshBasicMaterial color={color} />
                        </mesh>
                     </group>
                 );
             case ObjectType.GEM:
                 return (
                     <mesh geometry={GEM_GEOMETRY}>
                         <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} metalness={0.8} />
                     </mesh>
                 );
             case ObjectType.BULLET:
                 return (
                    <mesh geometry={BULLET_GEO} rotation={[Math.PI/2, 0, 0]}>
                        <meshBasicMaterial color="#00ffff" />
                    </mesh>
                 );
             case ObjectType.ENEMY_BULLET:
                 return (
                    <mesh geometry={ENEMY_BULLET_GEO}>
                        <meshBasicMaterial color="#ff0000" />
                    </mesh>
                 );
             case ObjectType.MISSILE:
                 return (
                    <group rotation={[Math.PI/2, 0, 0]}>
                        <mesh geometry={MISSILE_CORE_GEO}>
                             <meshStandardMaterial color="white" />
                        </mesh>
                        <mesh geometry={MISSILE_RING_GEO} position={[0, -0.5, 0]}>
                             <meshBasicMaterial color="red" />
                        </mesh>
                        <mesh position={[0, -1.6, 0]}>
                             <coneGeometry args={[0.2, 0.8, 8]} />
                             <meshBasicMaterial color="orange" />
                        </mesh>
                    </group>
                 );
             case ObjectType.SHOP_PORTAL:
                 return (
                    <group>
                        <mesh geometry={SHOP_OUTLINE_GEO} position={[0, 3.6, 0]}>
                            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} />
                        </mesh>
                        <mesh geometry={SHOP_FRAME_GEO} position={[0, 3.5, 0]}>
                             <meshStandardMaterial color="#111" />
                        </mesh>
                        <Text3D font={FONT_URL} size={0.5} position={[-0.8, 6.5, 0.6]}>
                            SHOP
                            <meshBasicMaterial color="#ffffff" />
                        </Text3D>
                    </group>
                 );
             case ObjectType.ALIEN:
                 return (
                     <group scale={[scale, scale, scale]}>
                         <mesh geometry={ALIEN_BODY_GEO}>
                             <meshStandardMaterial color="#444" />
                         </mesh>
                         <mesh geometry={ALIEN_DOME_GEO} position={[0, 0.15, 0]}>
                             <meshStandardMaterial color="#222" roughness={0.2} />
                         </mesh>
                         <mesh geometry={ALIEN_EYE_GEO} position={[0, 0.1, 0.25]}>
                             <meshBasicMaterial color="#ff0000" />
                         </mesh>
                     </group>
                 );
             case ObjectType.BARREL:
                 // --- ENEMY MODEL LOADING ---
                 if (variant) {
                     const path = ALIEN_PATHS[variant];
                     const proceduralFallback = (
                         <group scale={[scale, scale, scale]}>
                            {variant === EnemyVariant.SAUCER ? (
                                <>
                                    <mesh geometry={SAUCER_BODY}><meshStandardMaterial color="#888" metalness={0.8} /></mesh>
                                    <mesh geometry={SAUCER_DOME} position={[0, 0.15, 0]}><meshBasicMaterial color="#00ff00" transparent opacity={0.8} /></mesh>
                                    <mesh rotation={[Math.PI/2, 0, 0]}><torusGeometry args={[0.4, 0.05, 16, 32]} /><meshBasicMaterial color="#555" /></mesh>
                                </>
                            ) : variant === EnemyVariant.ARMORED ? (
                                <>
                                    <mesh geometry={ARMORED_BODY} position={[0, 0.3, 0]}><meshStandardMaterial color="#333" roughness={0.7} /></mesh>
                                    <mesh geometry={ARMORED_HEAD} position={[0, 0.75, 0]}><meshStandardMaterial color="#222" /></mesh>
                                    <mesh geometry={ARMORED_VISOR} position={[0, 0.75, 0.23]}><meshBasicMaterial color="#ff0000" /></mesh>
                                    <mesh geometry={ARMORED_SHOULDER} position={[-0.35, 0.6, 0]}><meshStandardMaterial color="#111" /></mesh>
                                    <mesh geometry={ARMORED_SHOULDER} position={[0.35, 0.6, 0]}><meshStandardMaterial color="#111" /></mesh>
                                </>
                            ) : (
                                <>
                                    <mesh geometry={ALIEN_GREEN_HEAD}><meshStandardMaterial color="green" roughness={0.4} /></mesh>
                                    <mesh geometry={ALIEN_GREEN_EYE} position={[0, 0.1, 0.4]}><meshBasicMaterial color="black" /></mesh>
                                </>
                            )}
                         </group>
                     );

                     return (
                         <ModelErrorBoundary fallback={proceduralFallback}>
                             <Suspense fallback={proceduralFallback}>
                                 <LoadedEnemy url={path} scale={scale} />
                             </Suspense>
                         </ModelErrorBoundary>
                     );
                 }
                 return null;
             default:
                 return null;
         }
    }, [type, color, value, variant, scale]);

    return (
        <group ref={meshRef}>
            {innerContent}
        </group>
    );
};

export const LevelManager: React.FC = () => {
  const { 
    status, 
    speed, 
    collectGem, 
    collectLetter, 
    collectedLetters,
    laneCount,
    setDistance,
    openShop,
    level,
    updateTime,
    damagePerShot,
    isSlowMotion
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);

  // --- Listen for Bullet Spawning ---
  useEffect(() => {
    const handlePlayerShoot = (e: CustomEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const { x, y, z, angle = 0 } = e.detail;
        
        // Spread shot adds angle
        const vx = Math.sin(angle) * BULLET_SPEED * 0.3; // Slight lateral velocity
        
        objectsRef.current.push({
            id: uuidv4(),
            type: ObjectType.BULLET,
            position: [x, y, z - 1], // Start slightly in front
            active: true,
            color: '#00ffff',
            // Custom velocity props stored in temp obj not strictly typed here but used in loop
            // For now simple straight shots + fake angle updates
            // We'll store lateral offset per frame in the loop
        });

        // HACK: Store lateral velocity on the object instance (JS dynamic prop)
        // Since we are rebuilding the array every frame, we need to be careful.
        // But `objectsRef.current` persists objects.
        const bullet = objectsRef.current[objectsRef.current.length - 1];
        (bullet as any).vx = vx;
    };
    window.addEventListener('player-shoot', handlePlayerShoot as any);
    return () => window.removeEventListener('player-shoot', handlePlayerShoot as any);
  }, [status]);


  // Handle resets and transitions
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = level !== prevLevel.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        distanceTraveled.current = 0;
        nextLetterDistance.current = getLetterInterval(1);

    } else if (isLevelUp && level > 1) {
        objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);
        objectsRef.current.push({
            id: uuidv4(),
            type: ObjectType.SHOP_PORTAL,
            position: [0, 0, -100], 
            active: true,
        });
        
        nextLetterDistance.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(level);
        setRenderTrigger(t => t + 1);
        
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
        setDistance(Math.floor(distanceTraveled.current));
    }
    
    prevStatus.current = status;
    prevLevel.current = level;
  }, [status, level, setDistance]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) {
              playerObjRef.current = group.children[0];
          }
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;

    const safeDelta = Math.min(delta, 0.05); 
    const time = state.clock.elapsedTime;
    
    // SLOW MOTION LOGIC:
    const effectiveSpeed = isSlowMotion ? speed * 0.5 : speed;
    const dist = effectiveSpeed * safeDelta;
    
    distanceTraveled.current += dist;
    updateTime(safeDelta);

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    
    if (playerObjRef.current) {
        playerObjRef.current.getWorldPosition(playerPos);
    }

    // 1. Move & Update
    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    // Separate bullets for collision checks
    const bullets = currentObjects.filter(o => o.type === ObjectType.BULLET && o.active);
    
    // Damageable Targets
    const targets = currentObjects.filter(o => 
        (o.type === ObjectType.BARREL || o.type === ObjectType.ALIEN || o.type === ObjectType.MISSILE) && o.active
    );

    for (const obj of currentObjects) {
        // --- Movement ---
        
        if (obj.type === ObjectType.BULLET) {
            obj.position[2] -= BULLET_SPEED * safeDelta;
            const vx = (obj as any).vx || 0;
            obj.position[0] += vx * safeDelta;

        } else if (obj.type === ObjectType.ENEMY_BULLET) {
            // Enemy bullets move towards +Z (player) or tracked velocity
             if (obj.velocity) {
                 obj.position[0] += obj.velocity[0] * safeDelta;
                 obj.position[1] += obj.velocity[1] * safeDelta;
                 obj.position[2] += obj.velocity[2] * safeDelta;
             } else {
                 obj.position[2] += ENEMY_BULLET_SPEED * safeDelta;
             }
        } else if (obj.type === ObjectType.MISSILE) {
            const missileSpeed = isSlowMotion ? MISSILE_SPEED * 0.5 : MISSILE_SPEED;
            obj.position[2] += dist + (isSlowMotion ? MISSILE_SPEED * 0.5 : MISSILE_SPEED) * safeDelta;
        } else {
             // Standard static object + Individual Speed Bonus
             // Enemies moving towards player faster (Bonus > 0)
             // Enemies moving slower relative to player approach (Bonus < 0)
             const bonus = obj.speedBonus || 0;
             obj.position[2] += dist + (bonus * safeDelta);
        }

        // --- ENEMY AI ---

        // 1. Green Alien (Dodger) - Strafes side to side
        if (obj.type === ObjectType.BARREL && obj.variant === EnemyVariant.GREEN_ALIEN && obj.active) {
            // Initialize random offset
            if (obj.strafeOffset === undefined) obj.strafeOffset = Math.random() * 100;
            
            // Strafe logic
            const strafeAmount = Math.sin(time * 3 + obj.strafeOffset) * 2.0 * safeDelta;
            obj.position[0] += strafeAmount;
            
            // Clamp to bounds approx
            const maxWidth = (laneCount * LANE_WIDTH) / 2 + 1;
            obj.position[0] = Math.max(-maxWidth, Math.min(maxWidth, obj.position[0]));
        }

        // 2. Saucer (Shooter) - Fires bullets
        if (obj.type === ObjectType.BARREL && obj.variant === EnemyVariant.SAUCER && obj.active) {
            if (obj.lastShotTime === undefined) obj.lastShotTime = time + Math.random(); // Random start delay

            if (time > obj.lastShotTime + 2.5) { // Fire every 2.5s
                obj.lastShotTime = time;
                
                // Calculate direction to player
                const dx = playerPos.x - obj.position[0];
                const dy = (playerPos.y + 0.5) - obj.position[1];
                const dz = playerPos.z - obj.position[2];
                const mag = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                const speed = isSlowMotion ? ENEMY_BULLET_SPEED * 0.5 : ENEMY_BULLET_SPEED;

                newSpawns.push({
                    id: uuidv4(),
                    type: ObjectType.ENEMY_BULLET,
                    position: [obj.position[0], obj.position[1], obj.position[2] + 1],
                    active: true,
                    velocity: [(dx/mag)*speed, (dy/mag)*speed, (dz/mag)*speed],
                    color: '#ff0000'
                });
                
                audio.playShoot(); // Reuse shoot sound or new one
                hasChanges = true;
            }
        }

        // Alien (Old flyer) AI Logic
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 newSpawns.push({
                     id: uuidv4(),
                     type: ObjectType.MISSILE,
                     position: [obj.position[0], 1.0, obj.position[2] + 2], 
                     active: true,
                     color: '#ff0000',
                     health: level * 2 // Missiles also have health (Doubled)
                 });
                 hasChanges = true;
                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                    detail: { position: obj.position, color: '#ff00ff' } 
                 }));
             }
        }

        let keep = true;
        if (obj.active) {
            
            // --- Auto Pickup Gems (Magnet) ---
            if (obj.type === ObjectType.GEM) {
                const distSq = playerPos.distanceToSquared(new THREE.Vector3(...obj.position));
                // 5 feet (game units) squared. 5 units = generous magnet range.
                if (distSq < 25) { 
                    collectGem(obj.points || 50);
                    audio.playGemCollect();
                    window.dispatchEvent(new CustomEvent('particle-burst', { 
                        detail: { 
                            position: obj.position, 
                            color: obj.color || '#ffffff' 
                        } 
                    }));
                    obj.active = false;
                    keep = false;
                    hasChanges = true;
                }
            }


            // --- Bullet Collision Logic ---
            if (obj.type === ObjectType.BULLET && keep) {
                 for (const target of targets) {
                     if (!target.active) continue;
                     
                     // Hitbox with Scale Consideration
                     const targetScale = target.scale || 1.0;
                     const hitRadius = 1.0 * targetScale;

                     const dx = Math.abs(obj.position[0] - target.position[0]);
                     const dz = Math.abs(obj.position[2] - target.position[2]);
                     
                     if (dx < hitRadius && dz < hitRadius) {
                         // Hit!
                         obj.active = false; // Bullet destroyed
                         keep = false;
                         hasChanges = true;
                         
                         // Damage Logic
                         if (target.health !== undefined) {
                             target.health -= damagePerShot;
                         } else {
                             target.health = 0; // Should have health, but fallback
                         }

                         // Visual feedback
                         window.dispatchEvent(new CustomEvent('particle-burst', { 
                            detail: { position: target.position, color: '#ffffff' } 
                         }));

                         if (target.health <= 0) {
                             // Destroyed
                             target.active = false;
                             collectGem(50); 
                             audio.playExplosion();
                             window.dispatchEvent(new CustomEvent('particle-burst', { 
                                detail: { position: target.position, color: '#ffaa00' } 
                             }));
                         } else {
                             // Hit but not destroyed
                             audio.playShoot(); // Small hit sound?
                         }

                         break; 
                     }
                 }
                 
                 // Shortened Range: 25% of 120 = 30
                 // Bullets move negative Z.
                 if (obj.position[2] < -30) {
                     keep = false;
                 }
            }
            
            // --- Player Collision Logic ---
            else if (keep) {
                const zThreshold = 2.0; 
                const inZZone = (obj.position[2] > playerPos.z - zThreshold) && (obj.position[2] < playerPos.z + zThreshold);
                
                if (obj.type === ObjectType.SHOP_PORTAL) {
                    const dz = Math.abs(obj.position[2] - playerPos.z);
                    if (dz < 2) { 
                        openShop();
                        obj.active = false;
                        hasChanges = true;
                        keep = false; 
                    }
                } else if (inZZone) {
                    const dx = Math.abs(obj.position[0] - playerPos.x);
                    
                    // Specific check for Enemy Bullets (smaller hitbox)
                    if (obj.type === ObjectType.ENEMY_BULLET) {
                        const dy = Math.abs(obj.position[1] - (playerPos.y + 0.6)); // Center on body
                        if (dx < 0.5 && dy < 0.6) {
                            window.dispatchEvent(new Event('player-hit'));
                            obj.active = false; 
                            hasChanges = true;
                            audio.playExplosion();
                        }
                    } else if (dx < 0.9 * (obj.scale || 1)) { 
                        const isDamageSource = obj.type === ObjectType.BARREL || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
                        
                        if (isDamageSource) {
                            // Hitbox
                            const playerBottom = playerPos.y;
                            const playerTop = playerPos.y + 1.8; 
                            let objBottom = 0; 
                            let objTop = 1.0;

                            const scale = obj.scale || 1;

                            if (obj.type === ObjectType.BARREL) {
                                if (obj.variant === EnemyVariant.SAUCER) {
                                     // Grounded saucer check
                                     objBottom = 0.0; objTop = 1.0 * scale;
                                } else if (obj.variant === EnemyVariant.ARMORED) {
                                     objBottom = 0.0; objTop = 1.5 * scale;
                                } else {
                                     // Green Alien
                                     objTop = 1.2 * scale;
                                }
                            }
                            else if (obj.type === ObjectType.MISSILE) { objBottom = 0.5; objTop = 1.5; } 
                            else if (obj.type === ObjectType.ALIEN) { objBottom = 1.0; objTop = 2.0; }

                            const isHit = (playerBottom < objTop) && (playerTop > objBottom);

                            if (isHit) { 
                                window.dispatchEvent(new Event('player-hit'));
                                obj.active = false; 
                                hasChanges = true;
                                audio.playExplosion();
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { position: obj.position, color: '#ff4400' } 
                                }));
                            }
                        } else {
                            // Item Collection
                            const dy = Math.abs(obj.position[1] - playerPos.y);
                            if (dy < 2.5) { 
                                if (obj.type === ObjectType.GEM) {
                                    collectGem(obj.points || 50);
                                    audio.playGemCollect();
                                }
                                if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                                    collectLetter(obj.targetIndex);
                                    audio.playLetterCollect();
                                }
                                
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { 
                                        position: obj.position, 
                                        color: obj.color || '#ffffff' 
                                    } 
                                }));

                                obj.active = false;
                                hasChanges = true;
                            }
                        }
                    }
                }
            }
        }

        if (obj.type !== ObjectType.BULLET && obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }

        if (keep) {
            keptObjects.push(obj);
        }
    }

    if (newSpawns.length > 0) {
        keptObjects.push(...newSpawns);
    }

    // 2. Spawning Logic
    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE && o.type !== ObjectType.BULLET && o.type !== ObjectType.ENEMY_BULLET);
    
    if (staticObjects.length > 0) {
        furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
        // Start spawning halfway up the path (60 units ahead of player instead of 120 max)
        furthestZ = -60; 
    }

    // Use Math.max to clamp spawn distance to SPAWN_DISTANCE (120)
    // This allows the track to be populated backwards from furthestZ up to the horizon.
    // If furthestZ is -60, next spawn is -63 (approx), then -66, etc.
    if (furthestZ > -SPAWN_DISTANCE) {
         // EXTREME DENSITY REDUCTION
         // Was 30 + speed * 0.2. Doubled again to 60 + speed * 0.2
         const minGap = 60 + (speed * 0.2); 
         // Ensure we spawn behind the furthest object, but not beyond the spawn horizon
         const spawnZ = Math.max(furthestZ - minGap, -SPAWN_DISTANCE);
         
         // Only spawn if we haven't hit the horizon clamp yet
         if (spawnZ < furthestZ) {
             const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

             if (isLetterDue) {
                 const lane = getRandomLane(laneCount);
                 const target = ['G','E','M','I','N','I'];
                 const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

                 if (availableIndices.length > 0) {
                     const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                     keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.LETTER,
                        position: [lane * LANE_WIDTH, 0.5, spawnZ], // Dropped to 0.5 (sitting on path)
                        active: true,
                        color: GEMINI_COLORS[chosenIndex],
                        value: target[chosenIndex],
                        targetIndex: chosenIndex
                     });
                     nextLetterDistance.current += getLetterInterval(level);
                     hasChanges = true;
                 } else {
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.GEM,
                        position: [lane * LANE_WIDTH, 0.2, spawnZ], // Dropped to 0.2 (sitting on path)
                        active: true,
                        color: '#00ffff',
                        points: 50
                    });
                    hasChanges = true;
                 }

             } else if (Math.random() > 0.1) { 
                // Decision: Obstacle vs Gem
                // Reduced density again. 
                // Was 85% chance for Gem (15% obstacle). Now 92% chance for Gem (8% obstacle).
                const isObstacle = Math.random() > 0.92;

                if (isObstacle) {
                    const spawnAlien = level >= 2 && Math.random() < 0.2; 
                    // HEALTH SCALING: Level 1 = 1HP (One shot), Level 2+ = Level * 2
                    const obstacleHealth = level === 1 ? 1 : level * 2;

                    if (spawnAlien) {
                        const availableLanes = [];
                        const maxLane = Math.floor(laneCount / 2);
                        for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                        availableLanes.sort(() => Math.random() - 0.5);

                        let alienCount = 1;
                        // Single aliens mostly now
                        
                        for (let k = 0; k < alienCount; k++) {
                            const lane = availableLanes[k];
                            keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.ALIEN,
                                position: [lane * LANE_WIDTH, 1.0, spawnZ], // Lowered from 1.5 to 1.0
                                active: true,
                                color: '#00ff00',
                                hasFired: false,
                                health: obstacleHealth,
                                maxHealth: obstacleHealth
                            });
                        }
                    } else {
                        const availableLanes = [];
                        const maxLane = Math.floor(laneCount / 2);
                        for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                        availableLanes.sort(() => Math.random() - 0.5);
                        
                        let countToSpawn = 1;
                        const p = Math.random();

                        // Adjusted probabilities for group sizes to reduce density significantly
                        if (p > 0.95) countToSpawn = Math.min(2, availableLanes.length); // Extremely rare to get 2
                        // Otherwise 1 (Default)

                        for (let i = 0; i < countToSpawn; i++) {
                            const lane = availableLanes[i];
                            
                            // VARIANT LOGIC
                            let variant = EnemyVariant.GREEN_ALIEN;
                            let height = 0.8; // Raised to 0.8 to prevent clipping (radius 0.5 + bob 0.2)
                            let hp = obstacleHealth;
                            let scale = 1.0;
                            let speedBonus = 0;

                            // Archetypes: Standard, Tank (Slow/Big/HighHP), Rusher (Fast/Small/LowHP)
                            const archetypeRoll = Math.random();
                            const canBeAdvanced = level >= 3;

                            if (canBeAdvanced && archetypeRoll > 0.8) {
                                // TANK
                                variant = EnemyVariant.ARMORED;
                                height = 0.8; // Grounded tank (was 1.2)
                                scale = 1.8;
                                hp = level * 6; // Doubled (was level * 3)
                                speedBonus = -1.5; // Slower approach
                            } else if (canBeAdvanced && archetypeRoll > 0.6) {
                                // RUSHER
                                variant = EnemyVariant.SAUCER;
                                height = 0.5; // Grounded saucer (was 1.0)
                                scale = 0.8;
                                hp = Math.max(2, Math.floor(level * 1.0)); // Doubled (was level * 0.5)
                                speedBonus = 5.0; // Fast approach
                            } else {
                                // STANDARD
                                variant = EnemyVariant.GREEN_ALIEN;
                                scale = 1.0;
                                hp = obstacleHealth;
                                speedBonus = 0;
                            }

                            keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.BARREL, 
                                position: [lane * LANE_WIDTH, height, spawnZ], 
                                active: true,
                                color: '#ff0000',
                                health: hp,
                                maxHealth: hp,
                                variant: variant,
                                scale: scale,
                                speedBonus: speedBonus
                            });

                            if (Math.random() < 0.3) {
                                keptObjects.push({
                                    id: uuidv4(),
                                    type: ObjectType.GEM,
                                    position: [lane * LANE_WIDTH, height + 1.2 * scale, spawnZ], // Lowered relative offset
                                    active: true,
                                    color: '#ffd700',
                                    points: 100
                                });
                            }
                        }
                    }

                } else {
                    const lane = getRandomLane(laneCount);
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.GEM,
                        position: [lane * LANE_WIDTH, 0.2, spawnZ], // Dropped to 0.2 (sitting on path)
                        active: true,
                        color: '#00ffff',
                        points: 50
                    });
                }
                hasChanges = true;
             }
         }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};
