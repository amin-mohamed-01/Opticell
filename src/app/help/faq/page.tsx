'use client';

import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const faqs = [
  { q: "What is OptiCell?", a: "It is a predictive maintenance system that uses AI to detect early signs of equipment failure." },
  { q: "How does the system predict failures?", a: "It analyzes sensor data (temperature, pressure, vibration) using trained machine learning models." },
  { q: "Does it support the Arabic language?", a: "Yes, fully! The interface is available in both Arabic and English." },
  { q: "Can I receive notifications by email?", a: "Absolutely! You can enable critical alerts and email reports from the settings." },
  { q: "Is the system secure?", a: "Yes, all data is encrypted and protected with the latest security protocols." },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-8">
          <ChevronLeft size={20} />
          Back
        </Link>

        <h1 className="text-4xl font-bold mb-12 text-center text-gray-900">
          Frequently Asked Questions
        </h1>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-5 text-right flex items-center justify-between hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-lg text-gray-900">{faq.q}</span>
                {openIndex === i ? <ChevronUp /> : <ChevronDown />}
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5 text-gray-600">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
