import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Scene } from '@babylonjs/core/scene';
import {
  PIZZA_CENTER,
  PIZZA_RADIUS,
  type CounterLayout,
} from '../../core/counterLayout';
import { cameraPosition } from '../../core/projection';
import type { DropZone } from '../../interact/DropZone';
import { createBasedCylinder, flatMaterial } from './greybox';

const CRUST_HEIGHT = 0.12;
const SAUCE_HEIGHT = 0.02;

export interface CounterScene {
  readonly scene: Scene;
  readonly pizzaZone: DropZone;
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

  const crust = createBasedCylinder(scene, 'pizzaCrust', {
    height: CRUST_HEIGHT,
    diameterTop: PIZZA_RADIUS * 2,
    tessellation: 48,
  });
  crust.position.set(PIZZA_CENTER.x, 0, PIZZA_CENTER.z);
  crust.material = flatMaterial(scene, 'crustMat', '#e0a458');
  crust.freezeWorldMatrix();

  const sauce = createBasedCylinder(scene, 'pizzaTop', {
    height: SAUCE_HEIGHT,
    diameterTop: PIZZA_RADIUS * 2 - 0.5,
    tessellation: 48,
  });
  sauce.position.set(PIZZA_CENTER.x, CRUST_HEIGHT, PIZZA_CENTER.z);
  sauce.material = flatMaterial(scene, 'pizzaTopMat', '#f6dc9a');
  sauce.freezeWorldMatrix();

  const pizzaZone: DropZone = {
    id: 'pizza',
    center: PIZZA_CENTER,
    // Forgiving (P3): a release a little outside the crust still counts and is pulled in.
    acceptRadius: PIZZA_RADIUS + 0.45,
    landRadius: PIZZA_RADIUS - 0.45,
    surfaceY: CRUST_HEIGHT + SAUCE_HEIGHT,
  };

  const applyLayout = (layout: CounterLayout): void => {
    const p = cameraPosition(layout.rig);
    camera.position.set(p.x, p.y, p.z);
    camera.setTarget(new Vector3(layout.rig.target.x, layout.rig.target.y, layout.rig.target.z));
    camera.fov = layout.rig.fovY;
  };

  return { scene, pizzaZone, applyLayout };
}
