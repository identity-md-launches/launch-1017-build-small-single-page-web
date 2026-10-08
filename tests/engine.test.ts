import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE, drop, newGame, placeFloor, startGame, tick } from '../src/engine.ts';
import { emptyRecords, finishRun, parseRecords } from '../src/storage.ts';

test('aligned drops snap within four units and preserve the full width', () => {
  for (const offset of [-4, 0, 4]) {
    const placed = placeFloor(BASE, { ...BASE, x: BASE.x + offset });
    assert.deepEqual(placed, { floor: BASE, perfect: true, cut: null });
  }
});

test('overhangs are cut on either side and the next floor inherits the surviving width', () => {
  const right = placeFloor(BASE, { x: 150, width: 160 });
  assert.deepEqual(right.floor, { x: 150, width: 130 });
  assert.deepEqual(right.cut, { x: 280, width: 30 });
  const left = placeFloor(right.floor!, { x: 125, width: 130 });
  assert.deepEqual(left.floor, { x: 150, width: 105 });
  assert.deepEqual(left.cut, { x: 125, width: 25 });
  const game = tick(drop({ ...startGame(), moving: { x: 150, width: 160 } }), 0.26);
  assert.equal(game.floors.length, 1);
  assert.equal(game.moving.width, 130);
});

test('no overlap, including exact edge contact, ends the run without adding a floor', () => {
  for (const x of [-40, 280, 320]) assert.equal(placeFloor(BASE, { x, width: 160 }).floor, null);
  const ended = tick(drop({ ...startGame(), moving: { x: 280, width: 160 } }), 0.26);
  assert.equal(ended.phase, 'over');
  assert.equal(ended.floors.length, 0);
  assert.equal(drop(ended), ended);
});

test('pause freezes both swing and drop; repeated drop input never skips floors', () => {
  const playing = tick(startGame(), 0.4);
  const paused = { ...playing, paused: true };
  assert.equal(tick(paused, 5), paused);
  assert.equal(drop(paused), paused);
  const falling = drop(playing);
  assert.equal(drop(falling), falling);
  const pausedFall = { ...falling, paused: true };
  assert.equal(tick(pausedFall, 5), pausedFall);
  assert.equal(tick(newGame(), 5).phase, 'ready');
});

test('long builds stay finite and swing remains within the site bounds', () => {
  let game = startGame();
  for (let i = 0; i < 100; i++) {
    game = tick(drop({ ...game, moving: { ...BASE } }), 0.26);
    assert.equal(game.floors.length, i + 1);
    for (let j = 0; j < 20; j++) {
      game = tick(game, 0.05);
      assert.ok(game.moving.x >= 26 && game.moving.x + game.moving.width <= 374);
    }
  }
  assert.equal(game.perfects, 100);
});

test('reduced effects preserve scoring and suppress falling cut pieces', () => {
  const falling = drop({ ...startGame(), moving: { x: 150, width: 160 } });
  const regular = tick(falling, 0.26);
  const reduced = tick(falling, 0.05, true);
  assert.deepEqual(reduced.floors, regular.floors);
  assert.equal(reduced.fragment, null);
  assert.ok(regular.fragment);
});

test('leaderboard keeps five ranked runs, stable ids and best across reload', () => {
  let records = emptyRecords();
  for (const height of [2, 8, 4, 12, 3, 6, 0]) records = finishRun(records, height, 0);
  assert.equal(records.best, 12);
  assert.equal(records.total, 7);
  assert.deepEqual(records.runs.map(run => run.height), [12, 8, 6, 4, 3]);
  assert.deepEqual(parseRecords(JSON.stringify(records)), records);
  records = finishRun(records, 12, 4);
  assert.equal(records.runs[0].id, 8);
});

test('corrupt or invalid storage recovers without trusting arbitrary fields', () => {
  for (const raw of [null, '{', 'null', '"unexpected"', '{"best":-1,"total":0,"runs":[]}']) assert.deepEqual(parseRecords(raw), emptyRecords());
  const safe = parseRecords(JSON.stringify({ best: 0, total: 0, runs: [null, { id: 1, height: 7, perfects: 2 }, { id: 2, height: '999', perfects: 0 }, { id: 3, height: 3, perfects: 5 }] }));
  assert.equal(safe.best, 7);
  assert.equal(safe.total, 1);
  assert.equal(safe.runs.length, 1);
});
