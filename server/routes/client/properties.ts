import { Router } from 'express'
import prisma from '../../prisma.js'
import { sendOpsAlert } from '../../services/telegramService.js'

const router = Router()

router.get('/properties', async (req, res) => {
  const tenantId = req.auth!.tenantId!

  try {
    const properties = await prisma.property.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(properties)
  } catch (err) {
    console.error('[properties GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/properties', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { name, address, description } = req.body as {
    name?: string
    address?: string
    description?: string
  }

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    const property = await prisma.property.create({
      data: {
        tenantId,
        name: name.trim(),
        address: address?.trim() ?? '',
        description: description?.trim() ?? '',
        isActive: false,
      },
    })

    await sendOpsAlert(
      `Новый объект от клиента ${tenant?.name ?? tenantId}: "${property.name}", ${property.address || 'адрес не указан'}`
    )

    res.status(201).json(property)
  } catch (err) {
    console.error('[properties POST] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/properties/:id', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { id } = req.params
  const { name, address, description, isActive } = req.body as {
    name?: string
    address?: string
    description?: string
    isActive?: boolean
  }

  const property = await prisma.property.findFirst({ where: { id, tenantId } })
  if (!property) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const updated = await prisma.property.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(isActive !== undefined && { isActive }),
        // avitoItemId не редактируется клиентом — только OPS
      },
    })
    res.json(updated)
  } catch (err) {
    console.error('[properties PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
