import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RepairTasks, repairFraction } from '../components/RepairTasks';
import { LabSandbox } from './sandbox';
import { examplePlan } from './repairPlan';

test('every task is required; simulation stays local and clamps progress', () => {
  const sandbox = new LabSandbox(10);
  sandbox.disaster('blackout');
  sandbox.plan(examplePlan('blackout'));
  expect(() => sandbox.repair()).toThrow();
  sandbox.task('checkins'); sandbox.task('checkins'); sandbox.task('checkins');
  const d = sandbox.snapshot().world!.disaster!;
  expect(d.repair_plan!.tasks[0].progress).toBe(2);
  expect(repairFraction(d)).toBe(0);
  expect(() => sandbox.repair()).toThrow();
  sandbox.task('call_a_friend');
  expect(sandbox.repair().world!.disaster).toBeNull();
});

test('repair panel discloses rationale, model and offline example', () => {
  const sandbox = new LabSandbox(10); sandbox.disaster('blight');
  const d = sandbox.plan(examplePlan('blight')).world!.disaster!;
  const html = renderToStaticMarkup(<RepairTasks disaster={d}/>);
  expect(html).toContain('Why the Mayor chose these');
  expect(html).toContain('offline example');
  expect(html).toContain('Read a news article or study for 30 min');
  expect(html).toContain('value="0" max="2"');
});
