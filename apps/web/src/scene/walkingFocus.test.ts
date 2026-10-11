import {test, expect} from 'bun:test';
import {Group, Mesh, BoxGeometry, OrthographicCamera} from 'three';
import {avatarScreenBounds, intersectsAvatar} from './avatarFocusGeometry';

test('measured head height follows replacement geometry and ignores hidden presets', () => {
  const body = new Group(), head = new Mesh(new BoxGeometry(1,2,1));
  body.add(head);
  const camera = new OrthographicCamera(-5,5,5,-5,.1,100);
  camera.position.z = 10; camera.updateMatrixWorld();
  const first = avatarScreenBounds(body,camera,{width:100,height:100})!;
  head.scale.y = 2;
  const tall = avatarScreenBounds(body,camera,{width:100,height:100})!;
  expect(tall.top).toBeLessThan(first.top);
  const hidden = new Mesh(new BoxGeometry(100,100,100)); hidden.visible = false; body.add(hidden);
  expect(avatarScreenBounds(body,camera,{width:100,height:100})).toEqual(tall);
  body.scale.setScalar(.5);
  expect(avatarScreenBounds(body,camera,{width:100,height:100})!.top).toBeCloseTo(first.top);
});
test('decluttering protects the body with a margin and clears after separation', () => {
  const body = {left:100,right:140,top:100,bottom:180};
  expect(intersectsAvatar({left:90,right:120,top:150,bottom:170},body)).toBe(true);
  expect(intersectsAvatar({left:110,right:130,top:80,bottom:94},body)).toBe(true);
  expect(intersectsAvatar({left:110,right:130,top:60,bottom:80},body)).toBe(false);
});
