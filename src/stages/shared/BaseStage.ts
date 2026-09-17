import '@babylonjs/core/Meshes/instancedMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { DEFAULT_DRAG_SOUNDS, wireDragSounds, type DragSoundMap } from '../../audio/dragSounds';
import type { Unsubscribe } from '../../core/events';
import { IdleTimer } from '../../core/IdleTimer';
import type { Stage } from '../../core/Stage';
import { lerp } from '../../core/vec';
import { DragController, type DragConfig, type DragSource } from '../../interact/DragController';
import type { DropZone } from '../../interact/DropZone';
import { TweenRunner, easeInOutQuad, easeOutBack, hopArc } from '../../interact/tween';
import type { StageContext } from '../StageContext';
import { CarryEffects, type CarryEffectOptions } from './CarryEffects';
import { HintLayer, type Hint } from './HintLayer';

export interface DragOptions {
  /** Sounds for grab, drop and miss. Null for a tool that makes its own noises. */
  readonly sounds?: DragSoundMap | null;
  /** Halo and sparkles on the carried piece. Omit for tools. */
  readonly effects?: CarryEffectOptions;
}

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
  private hints: HintLayer | null = null;
  private idlePrompt: string | null = null;
  private readonly idle = new IdleTimer(() => this.showHint());

  enter(ctx: StageContext): void {
    this.ctx = ctx;
    this.finished = false;
    this.idlePrompt = null;
    this.idle.poke();
    this.hints = this.own(new HintLayer(ctx.scene));
    // Any touch, claimed or not, means the child is busy: hints wait and get out of the way (P7).
    const busy = (): void => {
      this.idle.poke();
      this.hints?.cancel();
    };
    this.listen(
      ctx.input.onGrab(() => {
        busy();
        return false;
      }),
    );
    this.listen(ctx.input.onMove(busy));
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
    this.idle.update(dt);
    this.ctx.pizza.flush();
  }

  protected abstract onEnter(): void;
  protected onExit(): void {}

  /**
   * What to show after 10 idle seconds, given the state of play right now.
   * Null while there is nothing for the child to do (e.g. while baking).
   */
  protected hint(): Hint | null {
    return null;
  }

  /** Speak a prompt now, and again with each idle hint until the next one (A5). */
  protected announce(promptId: string): void {
    this.idlePrompt = promptId;
    this.idle.poke();
    this.ctx.audio.say(promptId);
  }

  private showHint(): void {
    const hint = this.finished ? null : this.hint();
    if (!hint || this.controllers.some((c) => c.isDragging)) return;
    this.hints?.play(hint, this.tweens);
    this.ctx.audio.play('hint');
    const prompt = hint.prompt ?? this.idlePrompt;
    if (prompt) this.ctx.audio.say(prompt);
  }

  /** Dispose `item` when the stage exits. */
  protected own<T extends { dispose(): void }>(item: T): T {
    this.cleanups.push(() => item.dispose());
    return item;
  }

  protected listen(off: Unsubscribe): void {
    this.cleanups.push(off);
  }

  protected drag(
    sources: readonly DragSource[],
    zones: readonly DropZone[],
    config: DragConfig,
    options: DragOptions = {},
  ): DragController {
    const controller = new DragController(this.ctx.input, sources, zones, config);
    this.controllers.push(controller);
    const sounds = options.sounds === undefined ? DEFAULT_DRAG_SOUNDS : options.sounds;
    if (sounds) this.listen(wireDragSounds(controller, this.ctx.audio, sounds));
    if (options.effects) this.own(new CarryEffects(this.ctx.scene, controller, this.tweens, options.effects));
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
