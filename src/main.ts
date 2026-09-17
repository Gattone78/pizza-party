import { Engine } from '@babylonjs/core/Engines/engine';
import { SynthAudio } from './audio/SynthAudio';
import { computeLayout, type CounterLayout } from './core/counterLayout';
import { Emitter } from './core/events';
import { screenToPlane } from './core/projection';
import { StageMachine } from './core/StageMachine';
import { clientToNdc, landscapeViewport } from './core/viewport';
import { TouchInput } from './input/TouchInput';
import gameConfig from './data/game.json';
import prompts from './data/prompts.json';
import { BakeStage } from './stages/bake/BakeStage';
import { CelebrateStage } from './stages/celebrate/CelebrateStage';
import { CutStage } from './stages/cut/CutStage';
import { PlateStage } from './stages/plate/PlateStage';
import { SauceStage } from './stages/sauce/SauceStage';
import { ServeStage } from './stages/serve/ServeStage';
import { createCounterScene } from './stages/shared/counterScene';
import type { StageContext } from './stages/StageContext';
import { ToppingsStage } from './stages/toppings/ToppingsStage';

/** Phones and tablets get a render-resolution cap to protect 60 fps on older GPUs. */
const MAX_DEVICE_PIXEL_RATIO = 2;

function lockPage(): void {
  // iOS Safari ignores user-scalable=no, so pinch and double-tap zoom are blocked here too.
  const block = (e: Event): void => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick', 'selectstart']) {
    document.addEventListener(type, block, { passive: false });
  }
  document.addEventListener('touchmove', block, { passive: false });
}

function bootstrap(): void {
  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  lockPage();

  const engine = new Engine(canvas, true, {
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO));

  const counter = createCounterScene(engine);
  const layoutEvents = new Emitter<{ changed: CounterLayout }>();
  let layout = computeLayout(landscapeViewport(window.innerWidth, window.innerHeight));

  const applyLayout = (): void => {
    layout = computeLayout(landscapeViewport(window.innerWidth, window.innerHeight));
    const { width, height, rotated } = layout.viewport;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.transform = rotated ? `translateX(${height}px) rotate(90deg)` : '';
    engine.resize();
    counter.applyLayout(layout);
    layoutEvents.emit('changed', layout);
  };
  applyLayout();

  // The one place raw pointer events are read; everything else sees GrabInput (X2).
  const audio = new SynthAudio(prompts);
  const input = new TouchInput(
    canvas,
    (clientX, clientY) => {
      const ndc = clientToNdc(layout.viewport, clientX, clientY);
      return screenToPlane(layout.rig, layout.aspect, ndc.x, ndc.y);
    },
    // Browsers keep audio locked until a real touch.
    () => audio.unlock(),
  );

  const ctx: StageContext = {
    scene: counter.scene,
    input,
    audio,
    config: gameConfig,
    pizza: counter.pizza,
    round: { plates: [], diners: [] },
    layout: () => layout,
    onLayoutChanged: (handler) => layoutEvents.on('changed', handler),
    next: () => machine.advance(),
  };
  // One pizza's journey (X1). After the celebration the loop wraps to a fresh pizza.
  const machine = new StageMachine(ctx)
    .register(new SauceStage())
    .register(new ToppingsStage())
    .register(new BakeStage())
    .register(new CutStage())
    .register(new PlateStage())
    .register(new ServeStage())
    .register(new CelebrateStage());
  machine.start();

  window.addEventListener('resize', applyLayout);
  window.addEventListener('orientationchange', applyLayout);
  window.addEventListener('blur', () => input.cancel());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) input.cancel();
  });

  const debug = new URLSearchParams(location.search).has('debug') ? createDebugReadout() : null;
  if (debug) Object.assign(window, { pizzaParty: { machine, engine, scene: counter.scene, audio } });

  engine.runRenderLoop(() => {
    // Clamp so a backgrounded tab does not fast-forward tweens on return.
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    try {
      machine.update(dt);
    } catch (error) {
      // The child never sees an error (N6): start over with a fresh pizza.
      console.error(error);
      engine.stopRenderLoop();
      location.reload();
      return;
    }
    audio.update();
    counter.scene.render();
    debug?.(engine.getFps());
  });
}

/** Parent-only FPS readout behind ?debug. Never shown in normal play (P2). */
function createDebugReadout(): (fps: number) => void {
  const el = document.createElement('div');
  el.id = 'debug';
  document.body.appendChild(el);
  let frames = 0;
  return (fps) => {
    if (frames++ % 30 === 0) el.textContent = `${fps.toFixed(0)} fps`;
  };
}

bootstrap();
