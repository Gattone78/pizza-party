import { rowPositions } from '../../core/counterLayout';
import { lerp, vec3 } from '../../core/vec';
import familyData from '../../data/family.json';
import { carryConfig, type DragSource } from '../../interact/DragController';
import type { DropZone } from '../../interact/DropZone';
import { easeInOutQuad, hopArc } from '../../interact/tween';
import { BaseStage } from '../shared/BaseStage';
import type { Hint } from '../shared/HintLayer';
import { createDiner, type DinerLook } from '../shared/props';
import type { DinerProp } from '../StageContext';

const FAMILY: readonly DinerLook[] = familyData;
const DINER_Z = 1.35;
const SERVE_Z = 0;
const PLATE_ROW_Z = -1.75;

/** Stage 5: family members sit along the far side; drag any plate to any of them (G5.1 to G5.3). */
export class ServeStage extends BaseStage {
  readonly id = 'serve';
  private nextHint: (() => Hint | null) | null = null;

  protected override hint(): Hint | null {
    return this.nextHint?.() ?? null;
  }

  protected override onExit(): void {
    this.nextHint = null;
  }

  protected onEnter(): void {
    const { scene, round } = this.ctx;
    const plates = round.plates;
    if (plates.length === 0) return this.finish();

    // A different mix of the family each round (G5.1).
    const guests = [...FAMILY].sort(() => Math.random() - 0.5).slice(0, plates.length);
    const seats = rowPositions(plates.length, DINER_Z);
    const diners: DinerProp[] = guests.map((look, i) => {
      const node = createDiner(scene, look);
      node.position.set(seats[i]?.x ?? 0, 0, DINER_Z);
      this.popIn(node);
      return { id: look.id, node };
    });
    round.diners = diners;

    const row = rowPositions(plates.length, PLATE_ROW_Z);
    plates.forEach((plate, i) => {
      const last = i === plates.length - 1;
      this.slide(plate.node, row[i] ?? { x: 0, z: PLATE_ROW_Z }, 0.6, last ? () => this.enableDrag() : undefined);
    });
  }

  private enableDrag(): void {
    const { plates, diners } = this.ctx.round;
    const zones: DropZone[] = diners.map((diner) => ({
      id: diner.id,
      center: vec3(diner.node.position.x, 0, SERVE_Z),
      acceptRadius: 1.25,
      landRadius: 0,
      surfaceY: 0,
      capacity: 1,
    }));
    const validZones = zones.map((z) => z.id);
    const sources: DragSource[] = plates.map((plate) => ({
      draggable: {
        id: plate.id,
        home: vec3(plate.node.position.x, 0, plate.node.position.z),
        validZones,
      },
      pickRadius: 1.05,
      view: plate.view,
    }));

    const controller = this.drag(sources, zones, carryConfig(0.35, 0.15), {
      sounds: { grabbed: 'pop', placed: 'clink', returned: 'boing' },
      effects: {},
    });
    this.announce('serve');
    let served = 0;
    const servedPlates = new Set<string>();
    const fedDiners = new Set<string>();
    // Point from a plate still waiting to someone still hungry.
    this.nextHint = () => {
      const source = sources.find((s) => !servedPlates.has(s.draggable.id));
      const zone = zones.find((z) => !fedDiners.has(z.id));
      if (!source || !zone) return null;
      return { from: source.draggable.home, to: zone.center, ring: { center: zone.center, radius: 0.95 } };
    };
    this.listen(
      controller.on('placed', ({ sourceId, zoneId }) => {
        const plate = plates.find((p) => p.id === sourceId);
        const diner = diners.find((d) => d.id === zoneId);
        servedPlates.add(sourceId);
        fedDiners.add(zoneId);
        if (diner) this.cheer(diner);
        this.tweens.delay(0.3, () => this.ctx.audio.play('yum'));
        const slice = plate?.slice;
        if (slice) {
          // Eaten, bite by bite.
          const from = slice.scaling.x;
          this.tweens.add(1.1, (t) => slice.scaling.setAll(lerp(from, 0.01, easeInOutQuad(t))));
        }
        if (++served === plates.length) this.finish(1.3);
      }),
    );
  }

  /** Two happy hops (G5.3). */
  private cheer(diner: DinerProp): void {
    this.tweens.add(0.9, (t) => {
      diner.node.position.y = hopArc((t * 2) % 1) * 0.45;
    }, () => {
      diner.node.position.y = 0;
    });
  }
}
