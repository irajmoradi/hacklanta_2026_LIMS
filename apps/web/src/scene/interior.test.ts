import { test, expect } from "bun:test";
import { boutiqueLayout, petPriceRange } from './interior';
import { boutiqueWalkable, moveBoutique } from './playerControl';

test('boutique left doorway connects spawn and exit without opening other walls', () => {
  const {door, spawn, exit} = boutiqueLayout;
  expect(door.x).toBe(-5);
  expect(spawn[1]).toBe(door.z);
  expect(exit[1]).toBe(door.z);
  expect(boutiqueWalkable(spawn)).toBe(true);
  expect(boutiqueWalkable(exit)).toBe(true);
  const destination=moveBoutique(spawn,[exit[0]-spawn[0],0]);
  expect(destination[0]).toBeCloseTo(exit[0]);
  expect(moveBoutique(exit,[spawn[0]-exit[0],0])[0]).toBeCloseTo(spawn[0]);
  expect(boutiqueWalkable([-5,0])).toBe(false);
  expect(boutiqueWalkable([0,4])).toBe(false);
  expect(boutiqueWalkable([5,door.z])).toBe(false);
  expect(boutiqueWalkable([-5,door.z+door.width/2])).toBe(false);
  expect(moveBoutique([-4,2],[0,-4])[1]).toBeGreaterThan(.8);
});

test('rack and shelves have disjoint AABBs and a shopper-width aisle', () => {
  const {rack, shelves} = boutiqueLayout;
  const overlaps=Math.abs(rack.x-shelves.x)<(rack.width+shelves.width)/2 && Math.abs(rack.z-shelves.z)<(rack.depth+shelves.depth)/2;
  expect(overlaps).toBe(false);
  const gap=rack.z-rack.depth/2-(shelves.z+shelves.depth/2);
  expect(gap).toBeGreaterThan(.5);
  const z=(rack.z-rack.depth/2+shelves.z+shelves.depth/2)/2;
  expect(boutiqueWalkable([rack.x,z])).toBe(true);
  expect(boutiqueWalkable([rack.x,rack.z])).toBe(false);
  expect(boutiqueWalkable([shelves.x,shelves.z])).toBe(false);
});

test('counter prices reflect current pet items, including empty and single-price shops', () => {
  expect(petPriceRange([{kind:'pet',price_coins:175},{kind:'pet',price_coins:40},{kind:'clothing',price_coins:1}])).toEqual({min:40,max:175});
  expect(petPriceRange([{kind:'pet',price_coins:0}])).toEqual({min:0,max:0});
  expect(petPriceRange([])).toBeNull();
});
import {
  snap,
  rotate,
  valid,
  snapped,
  interpolate,
  interpolateRotation,
  replay,
  starters,
} from "./interior";
test("quarter metre and 15 degree snapping", () => {
  expect(snap(0.14)).toBe(0.25);
  expect(snap(-0.14)).toBe(-0.25);
  expect(rotate(359)).toBe(0);
  expect(rotate(-16)).toBe(345);
});
test("collision, room bounds, rug layers and walls", () => {
  const sofa = starters[0];
  expect(valid({ ...sofa, x: 2 }, starters)).toBe(false);
  expect(valid({ ...sofa, x: 4 }, starters)).toBe(false);
  expect(valid({ ...sofa, x: -2, z: 1.25 }, starters)).toBe(true);
  const art = snapped({
    ...sofa,
    item_id: "wall_art_moon",
    kind: "wall_art_moon",
    x: 0,
    z: -2,
  });
  expect(art.z).toBe(-3.75);
  expect(valid(art, starters)).toBe(true);
});
test("interpolation converges and turns across zero", () => {
  expect(interpolate(0, 1, 0.05)).toBeGreaterThan(0.6);
  expect(interpolate(1, 1, 0.05)).toBe(1);
  expect(interpolateRotation(350, 10, 0.05)).toBeGreaterThan(350);
});
test("history reverses from the current snapshot", () => {
  const before = starters[0],
    after = { ...before, x: 0 };
  const moves = [
    {
      seq: 1,
      time: "2026-01-01T12:00:00Z",
      item_id: before.item_id,
      before_state: before,
      after_state: after,
    },
  ];
  expect(replay([after], moves, Date.parse("2026-01-01T11:59:00Z"))[0].x).toBe(
    -2,
  );
  expect(replay([after], moves, Date.parse("2026-01-01T12:00:01Z"))[0].x).toBe(
    0,
  );
});

test("floors isolate collisions and unknown photo objects have conservative bounds", () => {
  const photo = {item_id:"photo_a",kind:"custom-object",x:0,z:0,rot:0,stashed:false,seq:1,floor:1};
  expect(valid(photo, [{...photo,item_id:"photo_b",floor:0}])).toBe(true);
  expect(valid(photo, [{...photo,item_id:"photo_b",floor:1}])).toBe(false);
  expect(valid({...photo,x:4}, [])).toBe(false);
});
