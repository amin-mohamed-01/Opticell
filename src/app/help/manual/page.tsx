'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function UserManual() {
  return (
    <div className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-8">
          <ChevronLeft size={20} />
          Back to Help
        </Link>

        <h1 className="text-4xl font-bold mb-8 text-gray-900">
          OptiCell User Guide – AI-Powered Smart Maintenance System
        </h1>

        <div className="max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold mb-4">Overview</h2>
            <p>
              OptiCell is an advanced predictive maintenance system that uses artificial intelligence and the Internet of Things (IoT) to monitor industrial equipment in real time, predict failures before they occur, and reduce unplanned downtime by up to 85%.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Key Features</h2>
            <ul className="list-disc pl-8 space-y-3">
              <li>Real-time monitoring of temperature, pressure, and vibration</li>
              <li>Failure prediction using machine learning models</li>
              <li>Instant notifications via email and mobile</li>
              <li>Periodic reports and comprehensive analytics</li>
              <li>Full Arabic language support and dark mode</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
            <ol className="list-decimal pl-8 space-y-3">
              <li>Log in using your email</li>
              <li>Go to the dashboard to monitor equipment status</li>
              <li>Configure notifications from the account settings</li>
              <li>Review daily and weekly reports</li>
            </ol>
          </section>

          <div className="bg-blue-50 rounded-2xl p-8 mt-12 text-center border border-blue-200">
            <p className="text-xl font-semibold text-gray-900">Need additional help?</p>
            <Link href="/help/chat" className="inline-block mt-4 text-blue-600 font-bold text-lg hover:underline">
              Chat with our support team now →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
