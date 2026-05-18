import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    if (!process.env.POSTGRES_URI) {
      return NextResponse.json({ error: 'POSTGRES_URI is not set' }, { status: 500 });
    }

    const result = await db.query(`
      SELECT * FROM maintenance_report 
      ORDER BY created_at DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching maintenance reports:', error);
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
    const { machine_id, alert_id, user_id, status, human_review, priority } = body;

    // Default values if not provided
    const finalStatus = status || 'open';
    const finalPriority = priority || 'medium';

    // Mocking the required IDs if they are missing or if the user hasn't set them up yet
    const mId = machine_id || 1;
    const aId = alert_id || 1;
    const uId = user_id || 1;

    const result = await db.query(
      `INSERT INTO maintenance_report 
        (machine_id, alert_id, user_id, status, human_review, priority) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [mId, aId, uId, finalStatus, human_review, finalPriority]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating maintenance report:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    if (!process.env.POSTGRES_URI) {
      return NextResponse.json({ error: 'POSTGRES_URI is not set' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid report id is required as a query param (?id=...)' }, { status: 400 });
    }

    const result = await db.query(
      `DELETE FROM maintenance_report WHERE id = $1 RETURNING id`,
      [Number(id)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: `No report found with id ${id}` }, { status: 404 });
    }

    return NextResponse.json({ deleted: result.rows[0].id });
  } catch (error: any) {
    console.error('Error deleting maintenance report:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
