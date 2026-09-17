import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { BOWL_RADIUS, PLAY_AREA, TOOL_HOME } from '../../core/counterLayout';
import { vec3 } from '../../core/vec';
import { CoverageGrid, strokePoints } from '../../interact/CoverageGrid';
import type { Point2 } from '../../interact/CutTracker';
import { carryConfig, type DragController, type DragSource } from '../../interact/DragController';
import { BaseStage } from '../shared/BaseStage';
import { NodeView, flatMaterial } from '../shared/greybox';
import { CHEESE_BRUSH, PIZZA_TOP_RADIUS, SAUCE_BRUSH } from '../shared/Pizza';
import { BOTTLE_HEIGHT, BOWL_HEIGHT, createBottle, createBowl } from '../shared/props';

/** How far the bottle tips over while squirting, in radians from upright. */
const BOTTLE_TILT = 2.3;
const OFFSTAGE_X = PLAY_AREA.minX - 3;

/**
 * Stage 0: scribble sauce from the squeeze bottle, then sprinkle cheese from a
 * bowl. One tool at a time (G0.4); each auto-fills at 60% coverage (G0.2).
 */
export class SauceStage extends BaseStage {
  readonly id = 'sauce';

  protected onEnter(): void {
    // Every round starts from plain dough, however the last one ended (G6.2, N6).
    this.ctx.pizza.reset();
    this.startSauce();
  }

  private startSauce(): void {
    const { scene, pizza } = this.ctx;
    const scale = this.ctx.layout().targetScale;
    const { node, body } = createBottle(scene);
    this.own(node);
    node.position.set(TOOL_HOME.x, 0, TOOL_HOME.z);
    this.popIn(node, scale);

    const source: DragSource = {
      draggable: { id: 'bottle', home: TOOL_HOME, validZones: [] },
      pickRadius: BOWL_RADIUS * scale * 1.6,
      view: new NodeView(node, scale, false),
    };
    // The nozzle, not the finger, is the paint point, and it sits a little up-screen of the finger.
    const controller = this.drag([source], [], carryConfig(0.12, 0.35));

    const upright = (): void => {
      body.rotation.z = 0;
      body.position.set(0, 0, 0);
    };
    const tipped = (): void => {
      // Tip over so the nozzle tip sits on the node origin and the body leans away up-right.
      body.rotation.z = BOTTLE_TILT;
      body.position.set(Math.sin(BOTTLE_TILT) * BOTTLE_HEIGHT, -Math.cos(BOTTLE_TILT) * BOTTLE_HEIGHT, 0);
    };
    this.listen(controller.on('grabbed', tipped));
    this.listen(controller.on('released', upright));

    this.paintWith(controller, SAUCE_BRUSH, (p) => pizza.paintSauce(p), () => {
      this.stopDrag(controller);
      upright();
      this.tweens.add(0.7, (t) => pizza.fillSauce(t));
      this.hopAway(node, OFFSTAGE_X, () => this.startCheese());
    });
  }

  private startCheese(): void {
    const { scene, pizza } = this.ctx;
    const scale = this.ctx.layout().targetScale;
    const cheese = flatMaterial(scene, 'cheeseMat', '#f7d774');
    const bowl = this.own(createBowl(scene, 'cheese', cheese));
    bowl.position.set(TOOL_HOME.x, 0, TOOL_HOME.z);
    this.popIn(bowl, scale);

    const pinch = this.own(CreateSphere('cheesePinch', { diameter: 0.5, segments: 8 }, scene));
    pinch.scaling.y = 0.5;
    pinch.material = cheese;
    pinch.isPickable = false;
    pinch.isVisible = false;

    let count = 0;
    const source: DragSource = {
      draggable: { id: 'cheese', home: vec3(TOOL_HOME.x, BOWL_HEIGHT * scale, TOOL_HOME.z), validZones: [] },
      pickRadius: BOWL_RADIUS * scale * 1.6,
      createPiece: () => new NodeView(pinch.createInstance(`cheesePinch-${count++}`), scale),
    };
    const controller = this.drag([source], [], carryConfig(0.4, 0.3));
    this.listen(controller.on('grabbed', () => this.squash(bowl, scale)));

    this.paintWith(controller, CHEESE_BRUSH, (p) => pizza.paintCheese(p), () => {
      this.stopDrag(controller);
      this.tweens.add(0.7, () => pizza.fillCheese());
      this.hopAway(bowl, OFFSTAGE_X, () => this.finish());
    });
  }

  /** Paint along the drag path; call `onCovered` once enough of the pizza is covered. */
  private paintWith(
    controller: DragController,
    brush: number,
    paint: (p: Point2) => void,
    onCovered: () => void,
  ): void {
    const grid = new CoverageGrid(PIZZA_TOP_RADIUS);
    let last: Point2 | null = null;
    let covered = false;

    this.listen(controller.on('released', () => (last = null)));
    this.listen(
      controller.on('moved', ({ position }) => {
        if (covered) return;
        const p = this.ctx.pizza.toLocal(position);
        for (const point of last ? strokePoints(last, p, brush / 2) : [p]) {
          // Strokes off the pizza do nothing (G0.3).
          if (grid.paint(point.x, point.z, brush)) paint(point);
        }
        last = p;
        if (grid.coverage >= this.ctx.config.coverageToFill) {
          covered = true;
          // Finish after this event has been delivered, not from inside the controller.
          this.tweens.delay(0, onCovered);
        }
      }),
    );
  }
}
