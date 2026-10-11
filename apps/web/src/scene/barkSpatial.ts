import { Vector3, type Camera, type Object3D } from 'three';
import { barks } from '../sound/VoiceBarks';
const point = new Vector3(), eye = new Vector3(), projected = new Vector3();
export function locateBark(id:string, object:Object3D, camera:Camera, visible=true) {
  object.getWorldPosition(point); point.y+=1;
  camera.getWorldPosition(eye); projected.copy(point).project(camera);
  for (let ancestor:Object3D|null=object;ancestor;ancestor=ancestor.parent) visible=visible && ancestor.visible;
  barks.locate(id,point.distanceTo(eye),visible && Math.abs(projected.x)<=1 && Math.abs(projected.y)<=1 && projected.z>=-1 && projected.z<=1);
}
