import fs from 'fs';
import path from 'path';

export const TEMP_DIR = path.resolve(process.cwd(), 'temp_media');

// Ensure directory exists
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  } catch (err) {
    console.error('[Cleanup] Error creating temp dir:', err);
  }
}

/**
 * Safely delete a temporary file if it exists.
 */
export async function cleanupFile(filePath?: string): Promise<void> {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`[Cleanup] Deleted temp file: ${path.basename(filePath)}`);
    }
  } catch (err) {
    console.warn(`[Cleanup] Could not delete temp file ${filePath}:`, err);
  }
}

/**
 * Remove any leftover temporary files older than maxAgeMinutes.
 */
export async function runStaleFileCleanup(maxAgeMinutes = 30): Promise<number> {
  let cleanedCount = 0;
  try {
    if (!fs.existsSync(TEMP_DIR)) return 0;
    const files = await fs.promises.readdir(TEMP_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    for (const file of files) {
      // Ignore .gitkeep or hidden files
      if (file.startsWith('.')) continue;

      const fullPath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.promises.stat(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(fullPath);
          cleanedCount++;
        }
      } catch {
        // Ignore single file stat errors
      }
    }
  } catch (err) {
    console.error('[Cleanup] Periodic cleanup scan failed:', err);
  }
  return cleanedCount;
}

/**
 * Starts background interval timer for cleanup.
 */
export function startPeriodicCleanup(intervalMinutes = 15): NodeJS.Timeout {
  return setInterval(() => {
    runStaleFileCleanup(30).then((count) => {
      if (count > 0) {
        console.log(`[Cleanup] Periodic job cleaned ${count} stale temporary files.`);
      }
    });
  }, intervalMinutes * 60 * 1000).unref();
}
