import type { ComponentType } from 'react';
export type LabScene = { id: string; title: string; blurb: string; load: () => Promise<{ default: ComponentType }> };
export const LAB_SCENES: LabScene[] = [
  { id: 'town', title: 'Big town', blurb: 'A hundred neighbors, one living village.', load: () => import('./BigTown') },
  { id: 'disasters', title: 'Disasters & repair', blurb: 'See the town recover through shared effort.', load: () => import('./Disasters') },
  { id: 'futures', title: 'Village futures', blurb: 'Grow from the first plaza to a complete town.', load: () => import('./Futures') },
  { id: 'onboarding', title: 'Your first day', blurb: 'Create a village or join your friends.', load: () => import('./onboarding/OnboardingDemo') },
  { id: 'pipeline', title: 'Avatar studio', blurb: 'Follow a photo into a living avatar, one model at a time.', load: () => import('./pipeline/PipelineDemo') },
];
