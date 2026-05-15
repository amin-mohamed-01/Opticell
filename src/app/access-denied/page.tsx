'use client';

import Link from 'next/link';
import { ShieldAlert, Mail, LogIn } from 'lucide-react';

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="h-2 bg-gradient-to-r from-red-500 to-orange-500" />
          
          <div className="p-10 text-center">
            <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 hover:rotate-0 transition-transform duration-300">
              <ShieldAlert className="w-12 h-12 text-red-600" />
            </div>
            
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
              Access Restricted
            </h1>
            
            <p className="text-gray-500 mb-10 leading-relaxed">
              Your email address is not authorized to access this private platform. 
              If you believe this is a mistake, please contact your administrator.
            </p>
            
            <div className="grid gap-4">
              <Link 
                href="/login"
                className="flex items-center justify-center gap-2 w-full py-4 px-6 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-gray-200"
              >
                <LogIn className="w-5 h-5" />
                Back to Login
              </Link>
              
              <a 
                href="mailto:Shrifamazon@gmail.com"
                className="flex items-center justify-center gap-2 w-full py-4 px-6 bg-white text-gray-600 border border-gray-200 rounded-2xl font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <Mail className="w-5 h-5" />
                Contact Admin
              </a>
            </div>
          </div>
          
          <div className="px-10 py-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">
              OptiCell Security
            </span>
            <span className="text-xs text-gray-300">
              ID: {Math.random().toString(36).substring(7).toUpperCase()}
            </span>
          </div>
        </div>
        
        <p className="mt-8 text-center text-gray-400 text-sm">
          Protected by Firebase Authentication Layer
        </p>
      </div>
    </div>
  );
}
