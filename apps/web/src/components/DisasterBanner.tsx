import { createContext } from 'react';
import type { Disaster } from '../api/types';

export const DisasterContext = createContext<Disaster | null>(null);
