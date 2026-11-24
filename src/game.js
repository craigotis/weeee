import * as ex from 'excalibur';

const GROUND_HEIGHT = 40;

const MOVE_SPEED = 250;
const JUMP_SPEED = 550;
const GRAVITY = 1400;
// Ground braking (px/s^2) applied while on the ground with no input.
// Higher = shorter slide. From MOVE_SPEED: stop time = MOVE_SPEED / GROUND_DECEL,
// slide distance = MOVE_SPEED^2 / (2 * GROUND_DECEL).
const GROUND_DECEL = 2500;
// Air control (px/s^2): how hard A/D pushes horizontal velocity toward
// +/-MOVE_SPEED while airborne. Lower = floatier, less steerable jumps.
// Full reversal (MOVE_SPEED -> -MOVE_SPEED) takes 2 * MOVE_SPEED / AIR_ACCEL
// seconds (~0.4s here, vs. ~0.8s of airtime on a full jump).
const AIR_ACCEL = 1200;

const game = new ex.Engine({
  displayMode: ex.DisplayMode.FillScreen,
  backgroundColor: ex.Color.fromHex('#87ceeb'),
  physics: {
    solver: ex.SolverStrategy.Arcade,
    gravity: ex.vec(0, GRAVITY),
  },
});

class Ground extends ex.Actor {
  constructor() {
    super({
      name: 'ground',
      // Extra wide so it spans the window at any size; repositioned each frame.
      width: 4000,
      height: GROUND_HEIGHT,
      color: ex.Color.Black,
      collisionType: ex.CollisionType.Fixed,
    });
  }

  onPreUpdate(engine) {
    // Keep the ground pinned to the bottom of the window as it resizes.
    this.pos = ex.vec(engine.drawWidth / 2, engine.drawHeight - GROUND_HEIGHT / 2);
  }
}

// A small floating platform. Positioned relative to the window's bottom-center
// so it stays put (relative to the ground) when the window resizes.
// Max jump height is JUMP_SPEED^2 / (2 * GRAVITY) (~108px), so `heightAboveGround`
// (distance from ground top to block top) must stay below that to be reachable.
class Block extends ex.Actor {
  constructor({ offsetX, heightAboveGround, width = 80, height = 20 }) {
    super({
      name: 'block',
      width,
      height,
      color: ex.Color.fromHex('#8b4513'),
      collisionType: ex.CollisionType.Fixed,
    });
    this.offsetX = offsetX;
    this.heightAboveGround = heightAboveGround;
  }

  onPreUpdate(engine) {
    const groundTop = engine.drawHeight - GROUND_HEIGHT;
    this.pos = ex.vec(
      engine.drawWidth / 2 + this.offsetX,
      groundTop - this.heightAboveGround + this.height / 2,
    );
  }
}

class Player extends ex.Actor {
  constructor() {
    super({
      name: 'player',
      pos: ex.vec(game.drawWidth / 2, game.drawHeight / 2),
      radius: 20,
      color: ex.Color.Blue,
      collisionType: ex.CollisionType.Active,
    });
    this.onGround = false;
  }

  onPreUpdate(engine, elapsed) {
    const kb = engine.input.keyboard;

    // A / D: horizontal movement. On the ground, input sets speed instantly.
    // In the air, input nudges velocity toward the target speed at AIR_ACCEL,
    // and with no input the ball keeps its momentum.
    let dir = 0;
    if (kb.isHeld(ex.Keys.A)) dir -= 1;
    if (kb.isHeld(ex.Keys.D)) dir += 1;
    if (this.onGround) {
      if (dir !== 0) {
        this.vel.x = dir * MOVE_SPEED;
      } else {
        // Ground friction: brake toward zero at a fixed rate, without overshooting.
        const drop = GROUND_DECEL * (elapsed / 1000);
        this.vel.x = Math.sign(this.vel.x) * Math.max(0, Math.abs(this.vel.x) - drop);
      }
    } else if (dir !== 0) {
      // Air control: accelerate toward dir * MOVE_SPEED without overshooting it.
      const target = dir * MOVE_SPEED;
      const step = AIR_ACCEL * (elapsed / 1000);
      const diff = target - this.vel.x;
      this.vel.x += Math.sign(diff) * Math.min(Math.abs(diff), step);
    }

    // W / S: reserved for later
    // if (kb.isHeld(ex.Keys.W)) { }
    // if (kb.isHeld(ex.Keys.S)) { }

    // Space: jump (only when standing on something)
    if (kb.wasPressed(ex.Keys.Space) && this.onGround) {
      this.vel.y = -JUMP_SPEED;
    }

    // Reset; collision resolution later this frame sets it back if we're still grounded.
    this.onGround = false;

    // Keep the ball inside the window horizontally
    // (and kill momentum into the wall so it doesn't stick there).
    const r = this.collider.bounds.width / 2;
    const clampedX = ex.clamp(this.pos.x, r, engine.drawWidth - r);
    if (clampedX !== this.pos.x) {
      this.pos.x = clampedX;
      this.vel.x = 0;
    }
  }

  onPostCollisionResolve(self, other, side) {
    if (side === ex.Side.Bottom) {
      this.onGround = true;
    }
  }
}

game.add(new Ground());
game.add(new Block({ offsetX: 180, heightAboveGround: 80 }));
game.add(new Player());
game.start();
