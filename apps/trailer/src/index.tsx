import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Trailer} from './v4';
import './style.css';

const Root = () => <>
  <Composition id="VillageTrailer" component={Trailer} width={1920} height={1080} fps={60} durationInFrames={5640} defaultProps={{square: false}} />
  <Composition id="VillageSquare" component={Trailer} width={1080} height={1080} fps={60} durationInFrames={2340} defaultProps={{square: true}} />
</>;
registerRoot(Root);
