import { buildApp } from './app.js';
import { config } from './config/index.js';

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION] (non-fatal):', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (err) => {
  // Only crash on truly fatal errors, not EISDIR or similar I/O issues
  if (err && 'code' in err && (err as NodeJS.ErrnoException).code === 'EISDIR') {
    console.error('[UNCAUGHT EISDIR] (suppressed):', err.message);
    return;
  }
  console.error('[UNCAUGHT EXCEPTION]:', err);
  process.exit(1);
});

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Server running at http://${config.host}:${config.port}`);
    app.log.info(`API documentation available at http://${config.host}:${config.port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
