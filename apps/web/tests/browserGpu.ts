// Windows headless Chromium otherwise defaults to SwiftShader even with a discrete GPU.
// Opt in only on a machine with a working hardware driver; portable CI keeps software GL.
export const browserGpuArgs = process.env.VILLAGE_BROWSER_GPU === 'hardware' || process.env.VILLAGE_ARENA_HARDWARE_QA === '1'
  ? ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])]
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
