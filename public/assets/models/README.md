# 3D Assets

Store your `.glb` or `.gltf` model files in this directory.

## Usage in React Three Fiber

To load a model located at `public/assets/models/my-character.glb`:

```tsx
import { useGLTF } from '@react-three/drei';

export const MyComponent = () => {
  const { scene } = useGLTF('/assets/models/my-character.glb');
  return <primitive object={scene} />;
}
```

## Naming Convention
Use lowercase with hyphens (kebab-case) for file names:
- `player-mech.glb`
- `enemy-saucer.glb`
