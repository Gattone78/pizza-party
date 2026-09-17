import '@babylonjs/core/Meshes/instancedMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Unsubscribe } from '../../core/events';
import type { Stage } from '../../core/Stage';
import { lerp } from '../../core/vec';
import { DragController, type DragConfig, type DragSource } from '../../interact/DragController';
import type { DropZone } from '../../interact/DropZone';
import { TweenRunner, easeInOutQuad, easeOutBack, hopArc } from '../../interact/tween';
import type { StageContext } from '../StageContext';

/**
 * Housekeeping shared by every stage: everything registered through `own`,
 * `listen` or `drag` is torn down on exit, so a stage leaves nothing behind
 * (P4: one thing at a time).
 */
export abstract class BaseStage implements Stage<StageContext> {
  abstract readonly id: string;
  protected ctx!: StageContext;
  protected readonly tweens = new TweenRunner();
  private cleanups: (() => void)[] = [];
  private controllers: DragController[] = [];
  private finished = false;

  enter(ctx: StageContext): void {
    this.ctx = ctx;
    this.finished = false;
    this.onEnter();
  }

  exit(): void {
    this.onExit();
    this.controllers.forEach((c) => c.dispose());
    this.controllers = [];
    this.tweens.clear();
    this.cleanups.reverse().forEach((cleanup) => cleanup());
    this.cleanups = [];
  }

  update(dt: number): void {
    this.controllers.forEach((c) => c.update(dt));
    this.tweens.update(dt);
    this.ctx.pizza.flush();
  }

  protected abstract onEnter(): void;
  protected onExit(): void {}

  /** Dispose `item` when the stage exits. */
  protected own<T extends { dispose(): void }>(item: T): T {
    this.cleanups.push(() => item.dispose());
    return item;
  }

  protected listen(off: Unsubscribe): void {
    this.cleanups.push(off);
  }

  protected drag(sources: readonly DragSource[], zones: readonly DropZone[], config: DragConfig): DragController {
    const controller = new DragController(this.ctx.input, sources, zones, config);
    this.controllers.push(controller);
    return controller;
  }

  protected stopDrag(controller: DragController): void {
    controller.finishAll();
    controller.dispose();
    this.controllers = this.controllers.filter((c) => c !== controller);
  }

  /** Move on once, however many things ask. */
  protected finish(delay = 0): void {
    if (this.finished) return;
    this.finished = true;
    this.tweens.delay(delay, () => this.ctx.next());
  }

  /** Things arrive with a little pop so the change of stage is easy to follow. */
  protected popIn(node: TransformNode, scale = 1, duration = 0.3): void {
    node.scaling.setAll(0.01);
    this.tweens.add(duration, (t) => node.scaling.setAll(scale * lerp(0.01, 1, easeOutBack(t))));
  }

  /** Quick squash and spring back: the visual answer to a touch (P5). */
  protected squash(node: TransformNode, scale = 1): void {
    this.tweens.add(0.25, (t) => {
      node.scaling.y = scale * lerp(0.7, 1, easeOutBack(t));
    });
  }

  /** Hop off the side of the counter, then `then`. */
  protected hopAway(node: TransformNode, toX: number, then?: () => void): void {
    const fromX = node.position.x;
    const fromY = node.position.y;
    this.tweens.add(
      0.5,
      (t) => {
        node.position.x = lerp(fromX, toX, easeInOutQuad(t));
        node.position.y = fromY + hopArc(t) * 0.9;
      },
      then,
    );
  }

  protected slide(node: TransformNode, to: { x: number; z: number }, duration: number, then?: () => void): void {
    const fromX = node.position.x;
    const fromZ = node.position.z;
    this.tweens.add(
      duration,
      (t) => {
        const e = easeInOutQuad(t);
        node.position.x = lerp(fromX, to.x, e);
        node.position.z = lerp(fromZ, to.z, e);
      },
      then,
    );
  }
}
