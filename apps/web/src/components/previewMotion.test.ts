import { expect, test } from 'bun:test';
import { PreviewMotion } from './previewMotion';

test('drag pauses spin, clamps pitch, coasts and resumes only after four seconds', () => {
  const motion = new PreviewMotion();
  motion.down(1, 0, 0, 5000);
  motion.frame(0.02, 6000, false); expect(motion.yaw).toBe(0);
  motion.move(1, 100, 1000, 6010); expect(motion.pitch).toBe(0.35);
  motion.up(1, 6020);
  const yaw = motion.yaw; motion.frame(0.02, 6030, false); expect(motion.yaw).toBeGreaterThan(yaw);
  motion.reset(7000); motion.frame(0.02, 10999, false); expect(motion.yaw).toBe(0);
  motion.frame(0.02, 11000, false); expect(motion.yaw).toBeGreaterThan(0);
});
test('pinch and wheel respect zoom limits; reset restores the initial view', () => {
  const motion = new PreviewMotion();
  motion.down(1, 0, 0, 0); motion.down(2, 10, 0, 0); motion.move(2, 100, 0, 1);
  expect(motion.zoom).toBe(1.5); expect(motion.yaw).toBe(0);
  motion.wheel(10000, 2); expect(motion.zoom).toBe(0.7);
  motion.reset(3); expect(motion.zoom).toBe(1); expect(motion.pitch).toBe(0);
});
