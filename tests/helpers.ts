import type { Vec3 } from '../src/core/vec';
import type { GrabEventHandler, GrabHandler, GrabInput } from '../src/input/GrabInput';
import type { PieceView } from '../src/interact/DragController';

/** Scriptable GrabInput for driving game logic in tests. */
export class FakeInput implements GrabInput {
  private grabHandlers = new Set<GrabHandler>();
  private moveHandlers = new Set<GrabEventHandler>();
  private releaseHandlers = new Set<GrabEventHandler>();

  onGrab(handler: GrabHandler) {
    this.grabHandlers.add(handler);
    return () => this.grabHandlers.delete(handler);
  }
  onMove(handler: GrabEventHandler) {
    this.moveHandlers.add(handler);
    return () => this.moveHandlers.delete(handler);
  }
  onRelease(handler: GrabEventHandler) {
    this.releaseHandlers.add(handler);
    return () => this.releaseHandlers.delete(handler);
  }
  dispose() {}

  grab(position: Vec3): boolean {
    let claimed = false;
    this.grabHandlers.forEach((h) => {
      if (h({ position })) claimed = true;
    });
    return claimed;
  }
  move(position: Vec3) {
    this.moveHandlers.forEach((h) => h({ position }));
  }
  release(position: Vec3) {
    this.releaseHandlers.forEach((h) => h({ position }));
  }
}

export class FakePiece implements PieceView {
  position: Vec3 | null = null;
  scale = 1;
  disposed = false;
  maxY = -Infinity;

  setPosition(p: Vec3) {
    this.position = p;
    this.maxY = Math.max(this.maxY, p.y);
  }
  setScale(s: number) {
    this.scale = s;
  }
  dispose() {
    this.disposed = true;
  }
}
