import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, UserCheck, AlertCircle } from "lucide-react";

interface LoginProps {
  onLogin: (employeeId: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeId.length === 6 && /^\d+$/.test(employeeId)) {
      onLogin(employeeId);
    } else {
      setError("กรุณากรอกรหัสพนักงานให้ครบ 6 หลัก (ตัวเลขเท่านั้น)");
    }
  };

  return (
    <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-purple-200 p-8 border border-purple-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200 mb-4">
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-purple-900">เข้าสู่ระบบ TaskTracker</h1>
          <p className="text-purple-500 text-center mt-2">กรุณาระบุรหัสพนักงาน 6 หลักเพื่อดำเนินการต่อ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-purple-400 uppercase tracking-widest ml-1">รหัสพนักงาน</label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={employeeId}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setEmployeeId(val);
                  if (error) setError("");
                }}
                placeholder="123456"
                className="w-full px-5 py-4 bg-purple-50 border border-purple-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-xl font-mono tracking-[0.5em] text-center text-purple-900 placeholder:text-purple-200"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-purple-300">
                <UserCheck size={20} />
              </div>
            </div>
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs font-medium mt-2 ml-1"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold text-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98]"
          >
            ยืนยัน
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-purple-50 text-center">
          <p className="text-[10px] text-purple-300 uppercase tracking-widest font-bold">
            ระบบติดตามงานภายในหน่วยงาน
          </p>
        </div>
      </motion.div>
    </div>
  );
}
