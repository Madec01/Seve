// La Semeuse-Luthière. Déplacement libre, case visée = celle sous ses pieds :
// une seule règle de visée pour la souris, le clavier et le doigt.

import { PLAYER, TILE } from './constants.js';
import { clamp, smooth } from '../core/loop.js';
import { emit } from '../core/events.js';

export class Player {
  constructor(field) {
    this.field = field;
    this.x = (field.cols / 2) * TILE;
    this.y = (field.rows / 2) * TILE;
    this.vx = 0; this.vy = 0;
    this.facing = { x: 0, y: 1 };
    this.dash = 0;
    this.dashCd = 0;
    this.bob = 0;
    this.step = 0;
    this.actAnim = 0;
    this.tuneAnim = 0;
    this.hurt = 0;
    this.reach = PLAYER.reach;
    this.speedMult = 1;
    this.trail = [];
  }

  get col() { return clamp(Math.floor(this.x / TILE), 0, this.field.cols - 1); }
  get row() { return clamp(Math.floor(this.y / TILE), 0, this.field.rows - 1); }
  targetTile() { return this.field.at(this.col, this.row); }

  update(dt, move) {
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.actAnim = Math.max(0, this.actAnim - dt * 3.4);
    this.tuneAnim = Math.max(0, this.tuneAnim - dt * 2.0);
    this.hurt = Math.max(0, this.hurt - dt * 2);

    if (this.dash > 0) {
      this.dash -= dt;
      this.x += this.facing.x * PLAYER.dashSpeed * dt;
      this.y += this.facing.y * PLAYER.dashSpeed * dt;
      this.trail.push({ x: this.x, y: this.y, t: 0 });
    } else {
      const speed = PLAYER.speed * this.speedMult;
      const tx = move.x * speed;
      const ty = move.y * speed;
      const rate = (Math.abs(move.x) + Math.abs(move.y)) > 0.01 ? PLAYER.accel : PLAYER.friction;
      this.vx = smooth(this.vx, tx, rate, dt);
      this.vy = smooth(this.vy, ty, rate, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const mag = Math.hypot(move.x, move.y);
      if (mag > 0.15) {
        this.facing.x = move.x / mag;
        this.facing.y = move.y / mag;
      }
      const v = Math.hypot(this.vx, this.vy);
      this.bob += dt * (2 + v * 0.03);
      this.step += v * dt;
      if (this.step > 62) { this.step = 0; emit('player:step', { x: this.x, y: this.y }); }
    }

    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].t += dt;
      if (this.trail[i].t > 0.35) this.trail.splice(i, 1);
    }

    // Bornes du champ, avec une marge pour ne pas coller au bord.
    const m = PLAYER.radius * 0.5;
    this.x = clamp(this.x, m, this.field.cols * TILE - m);
    this.y = clamp(this.y, m, this.field.rows * TILE - m);
  }

  tryDash() {
    if (this.dash > 0 || this.dashCd > 0) return false;
    if (Math.hypot(this.facing.x, this.facing.y) < 0.1) this.facing = { x: 0, y: 1 };
    this.dash = PLAYER.dashTime;
    this.dashCd = PLAYER.dashCooldown;
    emit('player:dash', { x: this.x, y: this.y });
    return true;
  }

  isDashing() { return this.dash > 0; }
}
