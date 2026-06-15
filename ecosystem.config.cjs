// Код не загружает dotenv сам — читаем .env здесь и прокидываем в env
// каждого процесса, чтобы DATABASE_URL/JWT_SECRET были доступны после
// рестартов PM2 и pm2 resurrect (иначе Prisma коннектится в никуда).
const fileEnv = require('dotenv').config({
  path: require('path').join(__dirname, '.env')
}).parsed || {}

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
      // Логи в файлы с временными метками — переживают рестарты PM2
      error_file: '/var/log/avitobot/api-error.log',
      out_file: '/var/log/avitobot/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        ...fileEnv,
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
      restart_delay: 5000,
      max_restarts: 10,    // при краш-лупе PM2 остановит и поднимет OPS-алерт через мониторинг
      watch: false,
      error_file: '/var/log/avitobot/bot-error.log',
      out_file: '/var/log/avitobot/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        ...fileEnv,
        NODE_ENV: 'production'
      }
    }
  ]
}
