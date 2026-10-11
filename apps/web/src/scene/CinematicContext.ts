import { createContext } from 'react';
/** Only the plaza consumes this; opening a dialogue doesn't rebuild town geometry. */
export const MayorSpeaking = createContext(false);
