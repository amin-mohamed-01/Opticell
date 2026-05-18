import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    if (!process.env.POSTGRES_URI) {
      return NextResponse.json({ error: 'POSTGRES_URI is not set' }, { status: 500 });
    }

    const result = await db.query(`
      SELECT * FROM maintenance_report_data 
      ORDER BY created_at DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching maintenance report data:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    if (!process.env.POSTGRES_URI) {
      return NextResponse.json({ error: 'POSTGRES_URI is not set' }, { status: 500 });
    }

    const body = await req.json();
    const { report_id, maintenance_date, maintenance_type, notes } = body;

    if (!report_id || !maintenance_date || !maintenance_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await db.query(
      `INSERT INTO maintenance_report_data 
        (report_id, maintenance_date, maintenance_type, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [report_id, maintenance_date, maintenance_type, notes || '']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating maintenance report data:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    if (!process.env.POSTGRES_URI) {
      return NextResponse.json({ error: 'POSTGRES_URI is not set' }, { status: 500 });
    }

    const body = await req.json();
    const { id, report_id, maintenance_date, maintenance_type, notes } = body;

    if (!id || !report_id || !maintenance_date || !maintenance_type) {
      return NextResponse.json({ error: 'Missing required fields (id, report_id, maintenance_date, maintenance_type)' }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE maintenance_report_data
       SET report_id = $1,
           maintenance_date = $2,
           maintenance_type = $3,
           notes = $4
       WHERE id = $5
       RETURNING *`,
      [report_id, maintenance_date, maintenance_type, notes || '', id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: `No record found with id ${id}` }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating maintenance report data:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
