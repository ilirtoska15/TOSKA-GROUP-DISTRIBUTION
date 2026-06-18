import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Regions & Zones
  const prishtina = await db.region.upsert({
    where: { name: 'Prishtina' },
    update: {},
    create: { name: 'Prishtina' },
  })
  const prizren = await db.region.upsert({
    where: { name: 'Prizreni' },
    update: {},
    create: { name: 'Prizreni' },
  })

  const zoneQendra = await db.zone.upsert({
    where: { name_regionId: { name: 'Qendra', regionId: prishtina.id } },
    update: {},
    create: { name: 'Qendra', regionId: prishtina.id },
  })
  const zonePrizren1 = await db.zone.upsert({
    where: { name_regionId: { name: 'Zona 1', regionId: prizren.id } },
    update: {},
    create: { name: 'Zona 1', regionId: prizren.id },
  })

  // Categories
  const catDrinks = await db.category.upsert({ where: { name: 'Pije' }, update: {}, create: { name: 'Pije' } })
  const catFood = await db.category.upsert({ where: { name: 'Ushqime' }, update: {}, create: { name: 'Ushqime' } })
  const catDairy = await db.category.upsert({ where: { name: 'Bulmetore' }, update: {}, create: { name: 'Bulmetore' } })

  // Brands
  const brandCoca = await db.brand.upsert({ where: { name: 'Coca-Cola' }, update: {}, create: { name: 'Coca-Cola' } })
  const brandNestle = await db.brand.upsert({ where: { name: 'Nestlé' }, update: {}, create: { name: 'Nestlé' } })
  const brandLocal = await db.brand.upsert({ where: { name: 'Lokal' }, update: {}, create: { name: 'Lokal' } })

  // Users
  const adminPass = await bcrypt.hash('admin123', 10)
  const agentPass = await bcrypt.hash('agent123', 10)
  const shoferPass = await bcrypt.hash('shofer123', 10)
  const depoisPass = await bcrypt.hash('depoist123', 10)

  const admin = await db.user.upsert({
    where: { email: 'admin@toska.al' },
    update: {},
    create: {
      name: 'Administratori',
      email: 'admin@toska.al',
      password: adminPass,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  const agent1 = await db.user.upsert({
    where: { email: 'agjent1@toska.al' },
    update: {},
    create: {
      name: 'Arben Gashi',
      email: 'agjent1@toska.al',
      password: agentPass,
      role: 'AGJENT',
      status: 'ACTIVE',
      regionId: prishtina.id,
      zoneId: zoneQendra.id,
    },
  })

  const agent2 = await db.user.upsert({
    where: { email: 'agjent2@toska.al' },
    update: {},
    create: {
      name: 'Liridon Krasniqi',
      email: 'agjent2@toska.al',
      password: agentPass,
      role: 'AGJENT',
      status: 'ACTIVE',
      regionId: prizren.id,
      zoneId: zonePrizren1.id,
    },
  })

  const shofer1 = await db.user.upsert({
    where: { email: 'shofer1@toska.al' },
    update: {},
    create: {
      name: 'Besnik Halili',
      email: 'shofer1@toska.al',
      password: shoferPass,
      role: 'SHOFER',
      status: 'ACTIVE',
    },
  })

  const depoist1 = await db.user.upsert({
    where: { email: 'depoist1@toska.al' },
    update: {},
    create: {
      name: 'Faton Morina',
      email: 'depoist1@toska.al',
      password: depoisPass,
      role: 'DEPOIST',
      status: 'ACTIVE',
    },
  })

  // Give permissions
  await db.userPermission.upsert({
    where: { userId_permission: { userId: agent1.id, permission: 'collect_payments' } },
    update: {},
    create: { userId: agent1.id, permission: 'collect_payments', enabled: true },
  })
  await db.userPermission.upsert({
    where: { userId_permission: { userId: shofer1.id, permission: 'collect_payments' } },
    update: {},
    create: { userId: shofer1.id, permission: 'collect_payments', enabled: true },
  })

  // Products
  const prod1 = await createProduct(db, {
    code: 'PR000001',
    name: 'Coca-Cola 250ml',
    brandId: brandCoca.id,
    categoryId: catDrinks.id,
    photo: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300',
    salesPrice: 0.80,
    pakoCopje: 24,
    barcode: '5449000000439',
  })

  const prod2 = await createProduct(db, {
    code: 'PR000002',
    name: 'Coca-Cola 500ml',
    brandId: brandCoca.id,
    categoryId: catDrinks.id,
    photo: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
    salesPrice: 1.20,
    pakoCopje: 24,
    barcode: '5449000000446',
  })

  const prod3 = await createProduct(db, {
    code: 'PR000003',
    name: 'Nestlé Ujë 500ml',
    brandId: brandNestle.id,
    categoryId: catDrinks.id,
    photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300',
    salesPrice: 0.50,
    pakoCopje: 12,
    barcode: '7613034356826',
  })

  const prod4 = await createProduct(db, {
    code: 'PR000004',
    name: 'Djathë i Bardhë 400g',
    brandId: brandLocal.id,
    categoryId: catDairy.id,
    photo: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=300',
    salesPrice: 2.50,
    pakoCopje: 6,
  })

  const prod5 = await createProduct(db, {
    code: 'PR000005',
    name: 'Bukë e Bardhë 600g',
    brandId: brandLocal.id,
    categoryId: catFood.id,
    photo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300',
    salesPrice: 0.90,
    promotionActive: true,
    promotionText: '-10% këtë javë',
  })

  // Add opening stock
  for (const [prodId, qty] of [
    [prod1.id, 240], [prod2.id, 120], [prod3.id, 144], [prod4.id, 60], [prod5.id, 80],
  ] as [string, number][]) {
    const existing = await db.stockMovement.findFirst({ where: { productId: prodId, type: 'IN', reason: 'Stok fillestar' } })
    if (!existing) {
      await db.stockMovement.create({
        data: { productId: prodId, type: 'IN', quantityCopje: qty, reason: 'Stok fillestar', userId: admin.id },
      })
    }
  }

  // Customers
  const cust1 = await createCustomer(db, {
    code: 'MK000001',
    businessName: 'Dyqani Agim',
    businessAddress: 'Rruga Fehmi Agani 12',
    city: 'Prishtinë',
    phone: '+383 44 123 456',
    agentId: agent1.id,
    regionId: prishtina.id,
    zoneId: zoneQendra.id,
    debtLimit: 1000,
    lat: 42.6629,
    lng: 21.1655,
  })

  const cust2 = await createCustomer(db, {
    code: 'MK000002',
    businessName: 'Marketi Bahtiri',
    businessAddress: 'Bulevardi Nënë Tereza 45',
    city: 'Prishtinë',
    phone: '+383 44 234 567',
    agentId: agent1.id,
    regionId: prishtina.id,
    zoneId: zoneQendra.id,
    debtLimit: 2000,
    lat: 42.6527,
    lng: 21.1639,
  })

  const cust3 = await createCustomer(db, {
    code: 'MK000003',
    businessName: 'Kioska Prizrenase',
    businessAddress: 'Sheshi i Lirisë 3',
    city: 'Prizren',
    phone: '+383 45 345 678',
    agentId: agent2.id,
    regionId: prizren.id,
    zoneId: zonePrizren1.id,
    debtLimit: 500,
  })

  // System config defaults
  await db.systemConfig.upsert({ where: { key: 'catalog_show_price' }, update: {}, create: { key: 'catalog_show_price', value: 'false' } })
  await db.systemConfig.upsert({ where: { key: 'low_stock_threshold' }, update: {}, create: { key: 'low_stock_threshold', value: '20' } })
  await db.systemConfig.upsert({ where: { key: 'expiry_warning_days' }, update: {}, create: { key: 'expiry_warning_days', value: '30' } })
  await db.systemConfig.upsert({ where: { key: 'company_name' }, update: {}, create: { key: 'company_name', value: 'TOSKA DISTRIBUTION' } })

  // Targets for agent1
  const now = new Date()
  await db.target.upsert({
    where: { userId_month_year: { userId: agent1.id, month: now.getMonth() + 1, year: now.getFullYear() } },
    update: {},
    create: {
      userId: agent1.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      salesTarget: 5000,
      visitTarget: 80,
      orderTarget: 60,
      bonusAmount: 200,
      commissionPct: 1.5,
    },
  })

  console.log('✅ Seed complete!')
  console.log('\n📋 Test accounts:')
  console.log('  Admin:   admin@toska.al    / admin123')
  console.log('  Agjent:  agjent1@toska.al  / agent123')
  console.log('  Shofer:  shofer1@toska.al  / shofer123')
  console.log('  Depoist: depoist1@toska.al / depoist123')
}

async function createProduct(db: PrismaClient, data: {
  code: string; name: string; brandId?: string; categoryId?: string;
  photo: string; salesPrice: number; pakoCopje?: number;
  barcode?: string; promotionActive?: boolean; promotionText?: string;
}) {
  const counter = await db.sequenceCounter.upsert({
    where: { name_year: { name: 'product', year: 2024 } },
    update: { value: { increment: 1 } },
    create: { name: 'product', year: 2024, value: 1 },
  })

  return db.product.upsert({
    where: { code: data.code },
    update: {},
    create: {
      code: data.code,
      name: data.name,
      brandId: data.brandId,
      categoryId: data.categoryId,
      photo: data.photo,
      salesPrice: data.salesPrice,
      pakoCopje: data.pakoCopje,
      barcode: data.barcode,
      promotionActive: data.promotionActive ?? false,
      promotionText: data.promotionText,
      status: 'ACTIVE',
      showPricePublic: false,
    },
  })
}

async function createCustomer(db: PrismaClient, data: {
  code: string; businessName: string; businessAddress: string;
  city: string; phone: string; agentId?: string;
  regionId?: string; zoneId?: string; debtLimit?: number;
  lat?: number; lng?: number;
}) {
  return db.customer.upsert({
    where: { code: data.code },
    update: {},
    create: {
      code: data.code,
      businessName: data.businessName,
      businessAddress: data.businessAddress,
      city: data.city,
      phone: data.phone,
      agentId: data.agentId,
      regionId: data.regionId,
      zoneId: data.zoneId,
      debtLimit: data.debtLimit ?? 0,
      paymentTermDays: 30,
      status: 'ACTIVE',
      lat: data.lat,
      lng: data.lng,
    },
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
