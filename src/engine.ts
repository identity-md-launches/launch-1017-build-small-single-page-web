export type Floor = { x: number; width: number };
export type Placement = { floor: Floor | null; perfect: boolean; cut: Floor | null };
export const FLOOR_HEIGHT = 28;
export const BASE: Floor = { x: 120, width: 160 };

export function placeFloor(previous: Floor, moving: Floor): Placement {
  if (Math.abs(previous.x - moving.x) <= 4) {
    return { floor: { ...previous }, perfect: true, cut: null };
  }
  const left = Math.max(previous.x, moving.x);
  const right = Math.min(previous.x + previous.width, moving.x + moving.width);
  if (right <= left) return { floor: null, perfect: false, cut: { ...moving } };
  const cut = moving.x < previous.x
    ? { x: moving.x, width: left - moving.x }
    : { x: right, width: moving.x + moving.width - right };
  return { floor: { x: left, width: right - left }, perfect: false, cut };
}

export type Phase = 'ready' | 'swinging' | 'dropping' | 'over';
export type Game = {
  phase: Phase;
  paused: boolean;
  floors: Floor[];
  moving: Floor;
  elapsed: number;
  fall: number;
  perfects: number;
  message: string;
  fragment: (Floor & { y: number; age: number }) | null;
};

export function newGame(): Game {
  return { phase: 'ready', paused: false, floors: [], moving: { x: 168, width: 160 },
    elapsed: 0, fall: 0, perfects: 0, message: '', fragment: null };
}

export function startGame(): Game {
  return { ...newGame(), phase: 'swinging', moving: { x: 26, width: 160 } };
}

export function drop(game: Game): Game {
  return game.phase === 'swinging' && !game.paused ? { ...game, phase: 'dropping', fall: 0 } : game;
}

export function tick(game: Game, seconds: number, reducedMotion = false): Game {
  if (game.paused || game.phase === 'ready' || game.phase === 'over') return game;
  const next = { ...game };
  if (next.fragment) {
    next.fragment = { ...next.fragment, age: next.fragment.age + seconds };
    if (next.fragment.age > 0.6) next.fragment = null;
  }
  if (game.phase === 'swinging') {
    next.elapsed += seconds;
    const speed = 1.45 + Math.min(game.floors.length, 35) * 0.045;
    const range = 348 - game.moving.width;
    next.moving = { ...game.moving, x: 26 + (Math.sin(next.elapsed * speed - Math.PI / 2) + 1) / 2 * range };
    return next;
  }
  next.fall = Math.min(1, game.fall + seconds / (reducedMotion ? 0.05 : 0.26));
  if (next.fall < 1) return next;
  const result = placeFloor(game.floors.at(-1) ?? BASE, game.moving);
  if (!reducedMotion && result.cut) next.fragment = { ...result.cut, y: 350 - (game.floors.length + 1) * FLOOR_HEIGHT, age: 0 };
  if (!result.floor) return { ...next, phase: 'over', message: 'No overlap. Your build is complete.' };
  next.floors = [...game.floors, result.floor];
  next.perfects += Number(result.perfect);
  next.phase = 'swinging';
  next.elapsed = next.floors.length % 2 ? Math.PI / (1.45 + Math.min(next.floors.length, 35) * 0.045) : 0;
  next.moving = { x: next.floors.length % 2 ? 374 - result.floor.width : 26, width: result.floor.width };
  next.fall = 0;
  next.message = result.perfect ? `Perfect alignment. Floor ${next.floors.length}.` : `Floor ${next.floors.length}. ${Math.round(result.floor.width / BASE.width * 100)}% width remaining.`;
  return next;
}
