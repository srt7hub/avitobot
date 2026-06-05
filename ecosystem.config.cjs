module.exports = {
  apps: [
    {
      name: 'avitobot-api',
      script: 'server/index.ts',
      interpreter: 'tsx',
      max_memory_restart: '512M',
      restart_delay: 3000,
      kill_timeout: 30000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        API_PORT: '3010'
      }
    },
    {
      name: 'avitobot-bot',
      script: 'server/bot.ts',
      interpreter: 'tsx',
      instances: 1,        // СТРОГО 1 — иначе dedup сломается
      kill_timeout: 30000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
