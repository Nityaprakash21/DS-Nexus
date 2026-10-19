module.exports = {
  apps: [
    {
      name: "ds-nexus-api",
      script: "server.js",
      instances: "max", // Automatically scales across all available CPU cores
      exec_mode: "cluster",
      max_memory_restart: "1G", // Safeguard against memory leaks by restarting instances exceeding 1GB
      env_production: {
        NODE_ENV: "production"
      },
      env_development: {
        NODE_ENV: "development"
      },
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000 // 5 seconds graceful shutdown buffer for open sockets and DB connections
    }
  ]
};
