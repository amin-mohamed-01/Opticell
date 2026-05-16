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
    const numPredictions = searchParams.get('num_predictions') || '20';

    // Call the new pull-based sequence endpoint on the ML backend
    const mlRes = await fetch(`${ML_BACKEND_URL}/predict-sequence-latest?num_predictions=${numPredictions}&t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!mlRes.ok) {
      const errBody = await mlRes.json().catch(() => ({}));
      throw new Error(errBody.detail || `ML Backend Error: ${mlRes.status}`);
    }

    const sequenceResult = await mlRes.json();

    return NextResponse.json({
      success: true,
      ...sequenceResult
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('❌ ML Sequence Route Error:', error);
    return NextResponse.json({
      error: 'Sequence prediction failed',
      details: error.message
    }, { status: 500, headers: getCorsHeaders() });
  }
}
