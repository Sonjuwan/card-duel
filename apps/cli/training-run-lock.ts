import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

function openExclusive(lock: string): number {
  try { return openSync(lock, 'wx'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  // Serialize stale-lock reclaims. All new acquisitions still use O_EXCL.
  const recovery = lock + '.reclaim';
  const recoveryFd = openSync(recovery, 'wx');
  try {
    let owner: string;
    try { owner = readFileSync(lock, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return openSync(lock, 'wx');
    }
    const pid = Number(owner);
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 0x7fffffff) throw new Error('Run lock is active or unreadable');
    try { process.kill(pid, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      unlinkSync(lock);
      return openSync(lock, 'wx');
    }
    throw new Error('Another run is already running (PID ' + pid + ')');
  } finally {
    closeSync(recoveryFd);
    unlinkSync(recovery);
  }
}

export function acquireTrainingLock(lock: string): () => void {
  const fd = openExclusive(lock);
  const release = () => { closeSync(fd); unlinkSync(lock); };
  try { writeFileSync(fd, String(process.pid)); }
  catch (error) { release(); throw error; }
  return release;
}
