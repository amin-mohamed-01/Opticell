// src/components/HelpContent.tsx
'use client';

import {
  Mail,
  Phone,
  MessageCircle,
  FileText,
  LifeBuoy,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';

export default function HelpContent() {
  // --- AUTHENTICATION LOGIC START ---
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null; // The redirect will happen in useEffect
  }
  // --- AUTHENTICATION LOGIC END ---

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-7xl ltr">
      <h1 className="mb-12 text-4xl font-bold text-gray-900">
        Help & Support
      </h1>

      {/* Contact Support Cards */}
      <div className="mb-16 grid gap-6 md:grid-cols-3">
        {/* Email Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg transition hover:shadow-xl">
          <div className="mb-4 inline-block rounded-xl bg-blue-100 p-3">
            <Mail className="text-blue-600" size={28} />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-900">
            Email Support
          </h3>
          <p className="mb-6 text-gray-600">
            Get help via email
          </p>
          <a
            href="mailto:support@opticell.com"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700 font-medium"
          >
            support@opticell.com
          </a>
        </div>

        {/* Phone Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg transition hover:shadow-xl">
          <div className="mb-4 inline-block rounded-xl bg-green-100 p-3">
            <Phone className="text-green-600" size={28} />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-900">
            Phone Support
          </h3>
          <p className="mb-6 text-gray-600">
            24/7 Emergency Line
          </p>
          <a href="tel:+20123456789" className="text-2xl font-bold text-green-600">
            +20 123 456 789
          </a>
        </div>

        {/* Live Chat Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg transition hover:shadow-xl">
          <div className="mb-4 inline-block rounded-xl bg-purple-100 p-3">
            <MessageCircle className="text-purple-600" size={28} />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-900">
            Opticell AI
          </h3>
          <p className="mb-6 text-gray-600">
            Chat with our team
          </p>
          <Link href="/help/chat">
            <button className="w-full rounded-lg bg-purple-600 px-6 py-3 text-white transition hover:bg-purple-700 font-medium">
              Start Chat
            </button>
          </Link>
        </div>
      </div>

      {/* Resources Section */}
      <div>
        <h2 className="mb-8 text-2xl font-bold text-gray-900">
          Quick Resources
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* User Manual */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 transition hover:border-blue-500">
            <div className="flex items-start gap-5">
              <div className="rounded-lg bg-blue-100 p-4">
                <FileText className="text-blue-600" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  User Manual
                </h3>
                <p className="mb-6 text-gray-600">
                  Complete guide to OptiCell
                </p>
                <Link
                  href="/help/manual"
                  className="inline-flex items-center text-lg font-medium text-blue-600 hover:text-blue-700"
                >
                  Read More →
                </Link>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 transition hover:border-green-500">
            <div className="flex items-start gap-5">
              <div className="rounded-lg bg-green-100 p-4">
                <LifeBuoy className="text-green-600" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  FAQ
                </h3>
                <p className="mb-6 text-gray-600">
                  Frequently asked questions
                </p>
                <Link
                  href="/help/faq"
                  className="inline-flex items-center text-lg font-medium text-green-600 hover:text-green-700"
                >
                  Read More →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}