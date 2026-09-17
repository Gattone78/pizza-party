import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { PLAY_AREA } from '../../core/counterLayout';
import { hopArc } from '../../interact/tween';
import { BaseStage } from '../shared/BaseStage';
import { flatMaterial } from '../shared/greybox';

const COLORS = ['#ff5a5f', '#ffb400', '#2ec4b6', '#7b61ff', '#8ac926'];
const PIECES_PER_COLOR = 9;

/**
 * Celebration: soft drifting confetti and a bouncing family for a few seconds,
 * then a fresh pizza. Nothing flashes (N7); this is the loop's natural end (P8).
 */
export class CelebrateStage extends BaseStage {
  readonly id = 'celebrate';
  private time = 0;

  protected onEnter(): void {
    const { scene, config } = this.ctx;
    this.time = 0;

    COLORS.forEach((color, c) => {
      const source = this.own(CreateBox(`confetti-${c}`, { width: 0.22, depth: 0.14, height: 0.03 }, scene));
      source.material = flatMaterial(scene, `confettiMat-${c}`, color);
      source.isPickable = false;
      source.isVisible = false;
      for (let i = 0; i < PIECES_PER_COLOR; i++) {
        const piece = source.createInstance(`confetti-${c}-${i}`);
        piece.isPickable = false;
        const x = PLAY_AREA.minX + Math.random() * (PLAY_AREA.maxX - PLAY_AREA.minX);
        const z = PLAY_AREA.minZ + Math.random() * (PLAY_AREA.maxZ - PLAY_AREA.minZ);
        const sway = 0.3 + Math.random() * 0.4;
        const spin = 2 + Math.random() * 3;
        const fall = config.celebrateSeconds * (0.6 + Math.random() * 0.4);
        piece.position.set(x, 5, z);
        this.tweens.add(fall, (t) => {
          piece.position.set(x + Math.sin(t * 6) * sway, 5 * (1 - t) + 0.03, z);
          piece.rotation.set(t * spin, t * spin * 1.3, 0);
        });
      }
    });

    this.finish(config.celebrateSeconds);
  }

  override update(dt: number): void {
    super.update(dt);
    this.time += dt;
    this.ctx.round.diners.forEach((diner, i) => {
      diner.node.position.y = hopArc((this.time * 1.4 + i * 0.25) % 1) * 0.35;
    });
  }

  /** The round is over: clear the table for a fresh pizza (G5.4, G6.2). */
  protected override onExit(): void {
    const { pizza, round } = this.ctx;
    pizza.reset();
    round.plates.forEach((plate) => plate.node.dispose());
    round.diners.forEach((diner) => diner.node.dispose());
    round.plates = [];
    round.diners = [];
  }
}
