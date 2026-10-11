import 'react';

// React 18 forwards the native attribute, but this repository's typings predate it.
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: '' | 'auto' | 'manual';
  }
}
