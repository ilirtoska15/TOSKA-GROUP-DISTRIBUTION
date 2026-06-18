import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'sales'
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date()
  to.setHours(23, 59, 59, 999)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TOSKA DISTRIBUTION'
  wb.created = new Date()

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  }

  if (type === 'sales') {
    const orders = await db.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { notIn: ['DRAFT', 'ANULUAR'] } },
      include: {
        customer: { select: { businessName: true, code: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const ws = wb.addWorksheet('Shitjet')
    ws.columns = [
      { header: 'Referenca', key: 'reference', width: 14 },
      { header: 'Klienti', key: 'customer', width: 28 },
      { header: 'Kodi Klientit', key: 'code', width: 14 },
      { header: 'Agjenti', key: 'agent', width: 20 },
      { header: 'Shuma (€)', key: 'amount', width: 14 },
      { header: 'Statusi', key: 'status', width: 14 },
      { header: 'Data', key: 'date', width: 16 },
    ]
    ws.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle) })
    ws.getRow(1).height = 22

    for (const o of orders) {
      ws.addRow({
        reference: o.reference,
        customer: o.customer.businessName,
        code: o.customer.code,
        agent: o.createdBy.name,
        amount: Number(o.totalAmount),
        status: o.status,
        date: o.createdAt.toISOString().split('T')[0],
      })
    }

    const totalRow = ws.addRow({ reference: 'TOTALI', amount: orders.reduce((s, o) => s + Number(o.totalAmount), 0) })
    totalRow.font = { bold: true }
    ws.getColumn('amount').numFmt = '#,##0.00'
  } else if (type === 'payments') {
    const payments = await db.payment.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        customer: { select: { businessName: true, code: true } },
        collectedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const ws = wb.addWorksheet('Pagesat')
    ws.columns = [
      { header: 'Klienti', key: 'customer', width: 28 },
      { header: 'Kodi', key: 'code', width: 14 },
      { header: 'Shuma (€)', key: 'amount', width: 14 },
      { header: 'Metoda', key: 'method', width: 12 },
      { header: 'Mbledhur nga', key: 'agent', width: 20 },
      { header: 'Data', key: 'date', width: 16 },
      { header: 'Shënim', key: 'note', width: 30 },
    ]
    ws.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle) })
    ws.getRow(1).height = 22

    for (const p of payments) {
      ws.addRow({
        customer: p.customer.businessName,
        code: p.customer.code,
        amount: Number(p.amount),
        method: p.method,
        agent: p.collectedBy.name,
        date: p.createdAt.toISOString().split('T')[0],
        note: p.notes ?? '',
      })
    }
    ws.getColumn('amount').numFmt = '#,##0.00'
  } else if (type === 'debt') {
    const rawCustomers = await db.customer.findMany({
      where: { status: 'ACTIVE' },
      include: {
        orders: { where: { status: 'DORËZUAR' }, select: { totalAmount: true } },
        payments: { select: { amount: true } },
      },
    })

    const customers = rawCustomers
      .map(c => {
        const totalOrders = c.orders.reduce((s, o) => s + Number(o.totalAmount), 0)
        const totalPaid = c.payments.reduce((s, p) => s + Number(p.amount), 0)
        return { ...c, debt: totalOrders - totalPaid }
      })
      .filter(c => c.debt > 0)
      .sort((a, b) => b.debt - a.debt)

    const ws = wb.addWorksheet('Borxhet')
    ws.columns = [
      { header: 'Klienti', key: 'customer', width: 28 },
      { header: 'Kodi', key: 'code', width: 14 },
      { header: 'Borxhi (€)', key: 'debt', width: 14 },
      { header: 'Limiti (€)', key: 'limit', width: 14 },
      { header: 'Telefon', key: 'phone', width: 16 },
    ]
    ws.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle) })
    ws.getRow(1).height = 22

    for (const c of customers) {
      ws.addRow({
        customer: c.businessName,
        code: c.code,
        debt: c.debt,
        limit: c.debtLimit ? Number(c.debtLimit) : '',
        phone: c.phone ?? '',
      })
    }
    ws.getColumn('debt').numFmt = '#,##0.00'
    ws.getColumn('limit').numFmt = '#,##0.00'
  } else if (type === 'visits') {
    const visits = await db.visit.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        customer: { select: { businessName: true, code: true } },
        agent: { select: { name: true } },
      },
      orderBy: { openedAt: 'desc' },
    })

    const ws = wb.addWorksheet('Vizitat')
    ws.columns = [
      { header: 'Referenca', key: 'reference', width: 14 },
      { header: 'Klienti', key: 'customer', width: 28 },
      { header: 'Agjenti', key: 'agent', width: 20 },
      { header: 'Statusi', key: 'status', width: 14 },
      { header: 'Hapur', key: 'opened', width: 20 },
      { header: 'Mbyllur', key: 'closed', width: 20 },
    ]
    ws.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle) })
    ws.getRow(1).height = 22

    for (const v of visits) {
      ws.addRow({
        reference: v.reference,
        customer: v.customer.businessName,
        agent: v.agent.name,
        status: v.status,
        opened: v.openedAt.toISOString().replace('T', ' ').slice(0, 16),
        closed: v.closedAt ? v.closedAt.toISOString().replace('T', ' ').slice(0, 16) : '',
      })
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `toska_${type}_${new Date().toISOString().split('T')[0]}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
