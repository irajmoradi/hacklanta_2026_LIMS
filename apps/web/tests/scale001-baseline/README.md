These three unmodified scene modules come from commit `2abbd0e`, before SCALE-001
production changes. They are text fixtures, loaded only by `scale001.vite.config.ts`
when `SCALE_LABEL=before`. Keeping their original Vite module IDs lets the same
scratch data, camera, browser, and timing protocol exercise both renderers after
the implementation has changed. They are not production modules.
