import { execSync } from 'node:child_process';

const ports = [3000, 3001];

function killPortWindows(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const pids = new Set();
    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) {
        continue;
      }
      const pid = line.trim().split(/\s+/).at(-1);
      if (pid && pid !== '0') {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      console.log(`Stopped process ${pid} on port ${port}`);
    }
  } catch {
    // No listener on this port.
  }
}

function killPortUnix(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, {
      stdio: 'ignore',
      shell: true,
    });
    console.log(`Stopped process(es) on port ${port}`);
  } catch {
    // No listener on this port.
  }
}

for (const port of ports) {
  if (process.platform === 'win32') {
    killPortWindows(port);
  } else {
    killPortUnix(port);
  }
}
