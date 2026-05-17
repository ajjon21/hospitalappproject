const cluster = require('cluster');
const os = require('os');
const PORT = process.env.PORT || 3000;

if (cluster.isPrimary) {
  const cpuCount = os.cpus().length;
  console.log(`Primary process ${process.pid} starting ${cpuCount} workers`);

  for (let i = 0; i < Math.max(2, cpuCount); i += 1) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const app = require('./app');
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on http://localhost:${PORT}`);
  });
}
