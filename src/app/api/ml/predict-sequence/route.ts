import { NextRequest, NextResponse } from 'next/server';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';

const ML_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://memo-009-opticell-ml-backend.hf.space';

// CORS Headers
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sensorId = searchParams.get('sensorId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 1. Connect to MongoDB
    const connection = await connectToSaveDatabase();
    const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
    const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);

    // 2. Fetch readings (Sequence needs at least 15 for a single window)
    let query = {};
    if (sensorId) {
      query = { sensorId: parseInt(sensorId) || sensorId };
    }

    const rawReadings = await UploadModel.find(query)
      .sort({ _uploadedAt: -1 })
      .limit(limit);

    if (!rawReadings || rawReadings.length < 15) {
      return NextResponse.json({
        error: 'Insufficient sensor data',
        count: rawReadings?.length ?? 0,
        message: 'Need at least 15 readings for sequence prediction.'
      }, { status: 400, headers: getCorsHeaders() });
    }

    // 3. Format history (Oldest -> Newest)
    const history = rawReadings.map((doc: any) => {
      const d = doc.data || {};
      return {
        temprature: d.temprature ?? d.temperature ?? 0,
        humidity: d.humidity ?? 0,
        pressure: d.pressure ?? 102,
        gas_quality: d.gas_quality ?? d.gasQuality ?? 0,
      };
    }).reverse();

    // 4. Send to ML Backend (/predict-sequence)
    const mlRes = await fetch(`${ML_BACKEND_URL}/predict-sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, num_predictions: 20 }),
    });

    if (!mlRes.ok) {
      const errBody = await mlRes.json().catch(() => ({}));
      throw new Error(errBody.detail || `ML Backend Error: ${mlRes.status}`);
    }

    const sequenceResult = await mlRes.json();

    return NextResponse.json({
      success: true,
      ...sequenceResult,
      info: {
        readings_used: rawReadings.length,
        sensorId: sensorId || 'all'
      }
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('❌ ML Sequence Route Error:', error);
    return NextResponse.json({
      error: 'Sequence prediction failed',
      details: error.message
    }, { status: 500, headers: getCorsHeaders() });
  }
}
