import { NextRequest, NextResponse } from 'next/server';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';

const ML_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://memo-009-opticell-ml-backend.hf.space';

// CORS Headers for public API access
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

    // 1. Connect to specialized db-save MongoDB
    const connection = await connectToSaveDatabase();
    const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
    const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);

    // 2. Fetch latest 15 readings (ML needs at least 6 for rolling window)
    let query = {};
    if (sensorId) {
      query = { sensorId: parseInt(sensorId) || sensorId };
    }

    const rawReadings = await UploadModel.find(query)
      .sort({ _uploadedAt: -1 })
      .limit(15);

    if (!rawReadings || rawReadings.length < 6) {
      return NextResponse.json({
        error: 'Insufficient sensor data',
        count: rawReadings?.length ?? 0,
        message: 'Need at least 6 readings for ML prediction.'
      }, { status: 400, headers: getCorsHeaders() });
    }

    // 3. Format history for ML Backend (Oldest -> Newest)
    const history = rawReadings.map((doc: any) => {
      const d = doc.data || {};
      return {
        temprature: d.temprature ?? d.temperature ?? 0,
        humidity: d.humidity ?? 0,
        pressure: d.pressure ?? 102,
        gas_quality: d.gas_quality ?? d.gasQuality ?? 0,
      };
    }).reverse();

    // 4. Send to External ML Backend
    const mlRes = await fetch(`${ML_BACKEND_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
    });

    if (!mlRes.ok) {
      const errBody = await mlRes.json().catch(() => ({}));
      throw new Error(errBody.detail || `ML Backend Error: ${mlRes.status}`);
    }

    const prediction = await mlRes.json();

    // 5. Return prediction + latest reading metadata
    return NextResponse.json({
      success: true,
      prediction,
      latest_reading: {
        id: rawReadings[0]._id,
        timestamp: rawReadings[0]._uploadedAt,
        sensorId: rawReadings[0].sensorId,
        data: rawReadings[0].data
      }
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('❌ ML Prediction Route Error:', error);
    return NextResponse.json({
      error: 'Prediction failed',
      details: error.message
    }, { status: 500, headers: getCorsHeaders() });
  }
}
