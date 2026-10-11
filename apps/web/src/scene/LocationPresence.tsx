import {useEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Vector3} from 'three';
import {TOWN_SCALE} from './playerControl';
import type {LocationSpot,LocationPerson} from './locationCloseup';
export function LocationPresence({spot,onPeople}:{spot:LocationSpot|null;onPeople:(p:LocationPerson[])=>void}){
 const elapsed=useRef(1),last=useRef(''),point=useRef(new Vector3());
 useEffect(()=>{last.current='';elapsed.current=1;},[spot]);
 useFrame(({scene},dt)=>{elapsed.current+=dt;if(!spot||elapsed.current<.25)return;elapsed.current=0;const people:LocationPerson[]=[];
 scene.traverse(node=>{if(!node.name.startsWith('villager:'))return;node.getWorldPosition(point.current);if(Math.abs(point.current.x/TOWN_SCALE-spot.center[0])<8 && Math.abs(point.current.z/TOWN_SCALE-spot.center[1])<8)people.push({id:node.name.slice(9),activity:node.userData.activity??'Enjoying the village'});});
 const key=spot.id+JSON.stringify(people);if(key!==last.current){last.current=key;onPeople(people);}
 });return null;
}
