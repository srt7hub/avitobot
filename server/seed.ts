// Запускать один раз: tsx server/seed.ts
import prisma from './prisma.js'
import bcrypt from 'bcryptjs'

async function main() {
  const opsTenant = await prisma.tenant.upsert({
    where: { slug: 'ops-internal' },
    update: {},
    create: { name: 'Ops Team', slug: 'ops-internal', status: 'ACTIVE' }
  })

  const hash = await bcrypt.hash('changeme123', 12)

  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: opsTenant.id, email: 'ops@avitobot.ru' } },
    update: {},
    create: {
      tenantId: opsTenant.id,
      email: 'ops@avitobot.ru',
      password: hash,
      role: 'OPS',
      name: 'Ops Admin'
    }
  })

  console.log('OPS user created: ops@avitobot.ru / changeme123')
  console.log('ВАЖНО: сменить пароль после первого входа!')
}

main().finally(() => prisma.$disconnect())
