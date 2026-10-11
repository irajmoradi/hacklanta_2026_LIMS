import { createRoot } from 'react-dom/client';
import { VillageAlerts } from '../src/components/VillageAlerts';
import { LabSandbox } from '../src/lab/sandbox';
import { examplePlan } from '../src/lab/repairPlan';
import '../src/styles.css';
const sandbox = new LabSandbox(10);
sandbox.disaster('blackout');
const disaster = sandbox.plan(examplePlan('blackout')).world!.disaster;
createRoot(document.getElementById('root')!).render(<VillageAlerts disaster={disaster} events={[]} onRepair={() => {}} onEvents={() => {}}/>);
