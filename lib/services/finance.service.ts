import { query } from '../db';
import { buildSortClause, colomboDateFilterSql } from './shared';

export async function listTransactions(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  serviceType?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [];

  if (params.status && params.status !== 'all') {
    values.push(params.status);
    clauses.push(`pt.status = $${values.length}`);
  }
  if (params.serviceType && params.serviceType !== 'all') {
    values.push(params.serviceType);
    clauses.push(`b.service_type = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    clauses.push(colomboDateFilterSql('pt.created_at', values.length, '>='));
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    clauses.push(colomboDateFilterSql('pt.created_at', values.length, '<='));
  }
  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(pt.booking_id ILIKE ${p} OR COALESCE(pt.gateway_ref, '') ILIKE ${p} OR pt.method ILIKE ${p} OR u.full_name ILIKE ${p} OR u.account_id ILIKE ${p} OR COALESCE(u.phone, '') ILIKE ${p})`
    );
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'pt.created_at',
      amount_lkr: 'pt.amount_lkr',
      status: 'pt.status',
    },
    'pt.created_at'
  );

  const [countRes, summaryRes, byServiceRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM payment_transactions pt
       JOIN bookings b ON b.id = pt.booking_id
       JOIN users u ON u.id = pt.user_id
       ${whereSql}`,
      values
    ),
    query<{
      total_count: string;
      verified_lkr: string;
      completed_revenue_lkr: string;
      pending_lkr: string;
      refunded_lkr: string;
      failed_count: string;
      commission_lkr: string;
      rider_earnings_lkr: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_count,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'verified'), 0)::text AS verified_lkr,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'verified' AND b.status IN ('Completed', 'Delivered')), 0)::text AS completed_revenue_lkr,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'pending'), 0)::text AS pending_lkr,
         COALESCE(SUM(CASE WHEN pt.refund_amount_lkr > 0 THEN pt.refund_amount_lkr WHEN pt.status = 'refunded' THEN pt.amount_lkr ELSE 0 END), 0)::text AS refunded_lkr,
         COUNT(*) FILTER (WHERE pt.status = 'failed')::text AS failed_count,
         COALESCE(SUM(b.platform_commission_lkr) FILTER (WHERE pt.status = 'verified' AND b.status IN ('Completed', 'Delivered')), 0)::text AS commission_lkr,
         COALESCE(SUM(b.rider_earnings_lkr) FILTER (WHERE pt.status = 'verified' AND b.status IN ('Completed', 'Delivered')), 0)::text AS rider_earnings_lkr
       FROM payment_transactions pt
       JOIN bookings b ON b.id = pt.booking_id
       JOIN users u ON u.id = pt.user_id
       ${whereSql}`,
      values
    ),
    query<{
      service_type: string;
      tx_count: string;
      verified_lkr: string;
      completed_revenue_lkr: string;
      refunded_lkr: string;
      commission_lkr: string;
    }>(
      `SELECT
         b.service_type,
         COUNT(pt.id)::text AS tx_count,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'verified'), 0)::text AS verified_lkr,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'verified' AND b.status IN ('Completed', 'Delivered')), 0)::text AS completed_revenue_lkr,
         COALESCE(SUM(CASE WHEN pt.refund_amount_lkr > 0 THEN pt.refund_amount_lkr WHEN pt.status = 'refunded' THEN pt.amount_lkr ELSE 0 END), 0)::text AS refunded_lkr,
         COALESCE(SUM(b.platform_commission_lkr) FILTER (WHERE pt.status = 'verified' AND b.status IN ('Completed', 'Delivered')), 0)::text AS commission_lkr
       FROM payment_transactions pt
       JOIN bookings b ON b.id = pt.booking_id
       JOIN users u ON u.id = pt.user_id
       ${whereSql}
       GROUP BY b.service_type
       ORDER BY SUM(pt.amount_lkr) DESC`,
      values
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query(
    `SELECT
       pt.id, pt.booking_id, pt.user_id, pt.method, pt.amount_lkr, pt.currency,
       pt.gateway_ref, pt.status, pt.refund_amount_lkr, pt.refunded_at::text,
       pt.created_at::text,
       b.service_type, b.status AS booking_status, b.title AS booking_title,
       b.platform_commission_lkr, b.rider_earnings_lkr, b.savings_earned_lkr,
       u.full_name AS customer_name, u.phone AS customer_phone, u.account_id
     FROM payment_transactions pt
     JOIN bookings b ON b.id = pt.booking_id
     JOIN users u ON u.id = pt.user_id
     ${whereSql}
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const s = summaryRes.rows[0];
  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    summary: {
      totalCount: Number(s?.total_count ?? 0),
      verifiedLKR: Number(s?.verified_lkr ?? 0),
      completedRevenueLKR: Number(s?.completed_revenue_lkr ?? 0),
      pendingLKR: Number(s?.pending_lkr ?? 0),
      refundedLKR: Number(s?.refunded_lkr ?? 0),
      failedCount: Number(s?.failed_count ?? 0),
      commissionLKR: Number(s?.commission_lkr ?? 0),
      riderEarningsLKR: Number(s?.rider_earnings_lkr ?? 0),
    },
    byService: byServiceRes.rows.map((r) => ({
      serviceType: r.service_type,
      txCount: Number(r.tx_count),
      verifiedLKR: Number(r.verified_lkr),
      completedRevenueLKR: Number(r.completed_revenue_lkr),
      refundedLKR: Number(r.refunded_lkr),
      commissionLKR: Number(r.commission_lkr),
    })),
  };
}

export async function getTransactionDetail(id: string) {
  const res = await query(
    `SELECT
       pt.*, pt.refunded_at::text, pt.created_at::text,
       b.service_type, b.booking_mode, b.status AS booking_status, b.title AS booking_title,
       b.pickup_address, b.destination_address, b.subtotal_lkr,
       b.delivery_or_service_fee_lkr, b.discount_lkr, b.total_paid_lkr,
       b.platform_commission_lkr, b.rider_earnings_lkr, b.savings_earned_lkr,
       u.full_name AS customer_name, u.phone AS customer_phone, u.email AS customer_email, u.account_id
     FROM payment_transactions pt
     JOIN bookings b ON b.id = pt.booking_id
     JOIN users u ON u.id = pt.user_id
     WHERE pt.id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] ?? null;
}
