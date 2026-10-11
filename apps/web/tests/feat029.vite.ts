import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from '../vite.config';
export default mergeConfig(base, {resolve:{alias:{'@auth0/auth0-react':fileURLToPath(new URL('./feat029-auth0.tsx', import.meta.url))}}});
