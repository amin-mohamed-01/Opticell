import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reading from '@/models/Reading';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const headers = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate'
};

// GET /api/readings — Return latest 100 readings sorted by timestamp DESC
export async function GET() {
  try {
    await connectToDatabase();
    const readings = await Reading.find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    return NextResponse.json(readings, { status: 200, headers });
  } catch (error) {
    console.error('[GET /api/readings]', error);
    return NextResponse.json({ error: 'Failed to fetch readings' }, { status: 500, headers });
  }
}

// POST /api/readings — Insert a new reading
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (
      typeof body.sensorId !== 'number' ||
      typeof body.data !== 'object' ||
      body.data === null
    ) {
      return NextResponse.json(
        { error: 'Invalid payload. Expected: { sensorId: number, data: object }' },
        { status: 400, headers }
      );
    }

    await connectToDatabase();

    const reading = await Reading.create({
      sensorId: body.sensorId,
      data: body.data,
      timestamp: new Date(),
    });

    return NextResponse.json(reading, { status: 201, headers });
  } catch (error) {
    console.error('[POST /api/readings]', error);
    return NextResponse.json({ error: 'Failed to save reading' }, { status: 500, headers });
  }
}
