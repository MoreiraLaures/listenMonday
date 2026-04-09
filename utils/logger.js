function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(...args) {
  console.log(`[${ts()}]`, ...args);
}

module.exports = { log };
