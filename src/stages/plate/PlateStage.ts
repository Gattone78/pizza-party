import { platePositions } from '../../core/counterLayout';
import { lerp, vec3 } from '../../core/vec';
import { sliceCount } from '../../interact/CutTracker';
import { carryConfig, type DragSource } from '../../interact/DragController';
import type { DropZone } from '../../interact/DropZone';
import { easeOutCubic } from '../../interact/tween';
import { BaseStage } from '../shared/BaseStage';
import { NodeView } from '../shared/greybox';
import { PLATE_HEIGHT, createPlate } from '../shared/props';
import type { PlateProp } from '../StageContext';

const PLATE_RADIUS = 0.85;
/** Slices shrink a little as they land so a quarter pizza fits its plate. */
const PLATED_SCALE = 0.7;

/** Stage 4: one plate per slice; drag each slice to any plate (G4.1 to G4.4). */
export class PlateStage extends BaseStage {
  readonly id = 'plate';

  protected onEnter(): void {
    const { scene, pizza, config, round } = this.ctx;
    const slices = pizza.slice(config.cuts);
    const count = sliceCount(config.cuts);

    const plates: PlateProp[] = platePositions(count).map((p, i) => {
      const node = createPlate(scene, `plate-${i}`, PLATE_RADIUS);
      node.position.set(p.x, 0, p.z);
      this.popIn(node);
      return { id: `plate-${i}`, node, view: new NodeView(node, 1, false), slice: null };
    });
    // Plates carry on into the Serve stage, so the round owns them, not this stage.
    round.plates = plates;

    const zones: DropZone[] = plates.map((plate) => ({
      id: plate.id,
      center: vec3(plate.node.position.x, 0, plate.node.position.z),
      // Generous (P3): anywhere on that side of the pizza finds a plate.
      acceptRadius: PLATE_RADIUS * 2,
      landRadius: 0,
      surfaceY: PLATE_HEIGHT,
      capacity: 1,
    }));
    const validZones = zones.map((z) => z.id);

    const sources: DragSource[] = slices.map((slice) => {
      const world = slice.node.getAbsolutePosition();
      return {
        draggable: { id: `slice-${slice.index}`, home: vec3(world.x, 0, world.z), validZones },
        pickRadius: 1,
        view: slice.view,
      };
    });
    // Dragged slices leave the pizza so they move in counter coordinates.
    slices.forEach((slice) => slice.node.setParent(null));

    const controller = this.drag(sources, zones, carryConfig(0.35, 0.15));
    let plated = 0;
    this.listen(
      controller.on('placed', ({ sourceId, zoneId }) => {
        const slice = slices.find((s) => `slice-${s.index}` === sourceId);
        const plate = plates.find((p) => p.id === zoneId);
        if (!slice || !plate) return;
        slice.node.setParent(plate.node);
        plate.slice = slice.node;
        this.tweens.add(0.2, (t) => slice.node.scaling.setAll(lerp(1, PLATED_SCALE, easeOutCubic(t))));
        if (++plated === count) this.finish(0.7);
      }),
    );
  }
}
