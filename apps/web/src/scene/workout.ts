// Each villager cycles through three recognizable eight-second exercises.
export function workoutPose(seconds: number, slot: number) {
  const time = seconds + slot * 2, mode = Math.floor(time / 8) % 3;
  const pulse = (Math.sin(time * 4) + 1) / 2;
  return mode === 0
    ? {name:'push-ups', tilt:-Math.PI/2, y:.48 + pulse*.16, height:1, arm:1.3, spread:0, leg:0}
    : mode === 1
    ? {name:'squats', tilt:.12, y:-pulse*.28, height:1-pulse*.25, arm:-1.1, spread:0, leg:-pulse*.6}
    : {name:'jumping-jacks', tilt:0, y:pulse*.18, height:1, arm:0, spread:pulse*2.5, leg:0};
}
