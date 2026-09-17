import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Scene } from '@babylonjs/core/scene';
import type { CounterLayout } from '../../core/counterLayout';
import { cameraPosition } from '../../core/projection';
import { flatMaterial } from './greybox';
import { Pizza } from './Pizza';

export interface CounterScene {
  readonly scene: Scene;
  readonly pizza: Pizza;
  applyLayout(layout: CounterLayout): void;
}

/** The parts of the world every stage shares: camera, light, counter and the pizza. */
export function createCounterScene(engine: Engine): CounterScene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.17, 0.13, 0.09, 1);
  // Game code gets input only through GrabInput, so Babylon's own pointer handling is off.
  scene.detachControl();
  scene.skipPointerMovePicking = true;

  // Fixed camera (T1): no controls are ever attached.
  const camera = new FreeCamera('camera', Vector3.Zero(), scene);
  camera.minZ = 0.5;
  camera.maxZ = 200;

  const light = new HemisphericLight('light', new Vector3(0.2, 1, -0.4), scene);
  light.intensity = 1.05;

  const counter = CreateBox(
    'counter',
    {
      width: 24,
      depth: 20,
      height: 0.4,
    },
    scene,
  );
  counter.position.y = -0.2;
  counter.material = flatMaterial(scene, 'counterMat', '#d9b38c');
  counter.isPickable = false;
  counter.freezeWorldMatrix();

  const pizza = new Pizza(scene);

  const applyLayout = (layout: CounterLayout): void => {
    const p = cameraPosition(layout.rig);
    camera.position.set(p.x, p.y, p.z);
    camera.setTarget(new Vector3(layout.rig.target.x, layout.rig.target.y, layout.rig.target.z));
    camera.fov = layout.rig.fovY;
  };

  return { scene, pizza, applyLayout };
}
