module.exports = {
  apps: [
    {
      name: 'avitobot-api',
      script: 'server/index.ts',
      interpreter: 'tsx',
      max_memory_restart: '512M',
      restart_delay: 3000,
      kill_timeout: 30000,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'avitobot-bot',
      script: 'server/bot.ts',
      interpreter: 'tsx',
      instances: 1,
      kill_timeout: 30000,
      env: { NODE_ENV: 'production' }
    }
  ]
}
