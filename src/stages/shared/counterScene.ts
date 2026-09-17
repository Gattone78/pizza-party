import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import type { CounterLayout } from '../../core/counterLayout';
import { cameraPosition } from '../../core/projection';
import { createEnvironment } from '../../art/environment';
import { Pizza } from './Pizza';

export interface CounterScene {
  readonly scene: Scene;
  readonly pizza: Pizza;
  applyLayout(layout: CounterLayout): void;
}

/** The parts of the world every stage shares: camera, light, counter and the pizza. */
export function createCounterScene(engine: Engine): CounterScene {
  const scene = new Scene(engine);
  // Game code gets input only through GrabInput, so Babylon's own pointer handling is off.
  scene.detachControl();
  scene.skipPointerMovePicking = true;

  // Fixed camera (T1): no controls are ever attached.
  const camera = new FreeCamera('camera', Vector3.Zero(), scene);
  camera.minZ = 0.5;
  camera.maxZ = 200;

  createEnvironment(scene);
  const pizza = new Pizza(scene);

  const applyLayout = (layout: CounterLayout): void => {
    const p = cameraPosition(layout.rig);
    camera.position.set(p.x, p.y, p.z);
    camera.setTarget(new Vector3(layout.rig.target.x, layout.rig.target.y, layout.rig.target.z));
    camera.fov = layout.rig.fovY;
  };

  return { scene, pizza, applyLayout };
}
