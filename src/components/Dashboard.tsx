import React, { useMemo, useState } from "react";
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar as CalendarIcon,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
  ChevronRight
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, eachMonthOfInterval, subMonths, isSameMonth } from "date-fns";
import { th } from "date-fns/locale";
import { Task, UNITS, FREQUENCIES, TASK_TYPES, PRIORITIES } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  tasks: Task[];
}

export default function Dashboard({ tasks }: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  const monthOptions = [
    { value: 1, label: "มกราคม" },
    { value: 2, label: "กุมภาพันธ์" },
    { value: 3, label: "มีนาคม" },
    { value: 4, label: "เมษายน" },
    { value: 5, label: "พฤษภาคม" },
    { value: 6, label: "มิถุนายน" },
    { value: 7, label: "กรกฎาคม" },
    { value: 8, label: "สิงหาคม" },
    { value: 9, label: "กันยายน" },
    { value: 10, label: "ตุลาคม" },
    { value: 11, label: "พฤศจิกายน" },
    { value: 12, label: "ธันวาคม" },
  ];

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    tasks.forEach(t => {
      if (t.plannedDate) {
        const year = parseISO(t.plannedDate).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
    });
    // Add current year if not present
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.plannedDate) return false;
      const date = parseISO(t.plannedDate);
      const monthMatch = selectedMonth === "all" || (date.getMonth() + 1) === selectedMonth;
      const yearMatch = selectedYear === "all" || date.getFullYear() === selectedYear;
      return monthMatch && yearMatch;
    });
  }, [tasks, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const early = filteredTasks.filter(t => t.status === "ก่อนเวลา").length;
    const onTime = filteredTasks.filter(t => t.status === "ตรงเวลา").length;
    const delayed = filteredTasks.filter(t => t.status === "ล่าช้า").length;
    const pending = filteredTasks.filter(t => t.status === "รอดำเนินการ").length;
    
    // Unit Breakdown
    const unitData = UNITS.map(unit => {
      const unitTasks = filteredTasks.filter(t => t.unit === unit);
      return {
        name: unit,
        total: unitTasks.length,
        completed: unitTasks.filter(t => t.actualDate).length,
        delayed: unitTasks.filter(t => t.status === "ล่าช้า").length,
        pending: unitTasks.filter(t => t.status === "รอดำเนินการ").length
      };
    }).sort((a, b) => b.total - a.total);

    // Frequency Breakdown
    const freqData = FREQUENCIES.map(freq => ({
      name: freq,
      value: filteredTasks.filter(t => t.frequency === freq).length
    })).filter(d => d.value > 0);

    // Task Type Breakdown
    const typeData = TASK_TYPES.map(type => ({
      name: type,
      value: filteredTasks.filter(t => t.type === type).length
    })).filter(d => d.value > 0);

    // Priority Breakdown
    const priorityData = PRIORITIES.map(priority => ({
      name: priority,
      value: filteredTasks.filter(t => t.priority === priority).length
    })).filter(d => d.value > 0);

    // Status Pie Data
    const statusData = [
      { name: "ก่อนเวลา", value: early, color: "#10b981" },
      { name: "ตรงเวลา", value: onTime, color: "#3b82f6" },
      { name: "ล่าช้า", value: delayed, color: "#ef4444" },
      { name: "รอดำเนินการ", value: pending, color: "#f59e0b" }
    ].filter(d => d.value > 0);

    // Monthly Trend (Always use all tasks for trend, last 12 months)
    const trendMonths = eachMonthOfInterval({ 
      start: subMonths(new Date(), 11), 
      end: new Date() 
    });
    
    const trendData = trendMonths.map(month => {
      const mTasks = tasks.filter(t => {
        if (!t.plannedDate) return false;
        try {
          return isSameMonth(parseISO(t.plannedDate), month);
        } catch (e) {
          return false;
        }
      });
      return {
        name: format(month, "MMM yy", { locale: th }),
        total: mTasks.length,
        completed: mTasks.filter(t => t.actualDate).length
      };
    });

    return { total, early, onTime, delayed, pending, unitData, statusData, freqData, trendData, typeData, priorityData };
  }, [filteredTasks, tasks]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ภาพรวมการติดตามงาน</h2>
          <p className="text-slate-500 text-sm">วิเคราะห์ประสิทธิภาพการดำเนินงานรายหน่วย</p>
        </div>
        
        <div className="flex items-center gap-2 bg-purple-50 p-1.5 rounded-2xl border border-purple-100">
          <button
            onClick={() => { setSelectedMonth("all"); setSelectedYear("all"); }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              (selectedMonth === "all" && selectedYear === "all") ? "bg-white text-purple-900 shadow-sm border border-purple-100" : "text-purple-400 hover:text-purple-600"
            )}
          >
            ทั้งหมด
          </button>
          <div className="w-px h-4 bg-purple-200 mx-1" />
          
          <div className="flex items-center gap-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-purple-700 focus:outline-none px-2 cursor-pointer"
            >
              <option value="all">ทุกเดือน</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-purple-700 focus:outline-none px-2 cursor-pointer"
            >
              <option value="all">ทุกปี</option>
              {yearOptions.map(year => (
                <option key={year} value={year}>{year + 543}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "งานทั้งหมด", value: stats.total, icon: TrendingUp, color: "purple", sub: "รายการ" },
          { label: "รอดำเนินการ", value: stats.pending, icon: Clock, color: "amber", sub: "ยังไม่เสร็จ" },
          { label: "ก่อนเวลา", value: stats.early, icon: CheckCircle2, color: "emerald", sub: "ประสิทธิภาพดี" },
          { label: "ตรงเวลา", value: stats.onTime, icon: Clock, color: "blue", sub: "ตามแผนงาน" },
          { label: "ล่าช้า", value: stats.delayed, icon: AlertCircle, color: "red", sub: "ต้องเร่งรัด" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-[28px] border border-black/5 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                item.color === "purple" ? "bg-purple-50 text-purple-600" :
                item.color === "amber" ? "bg-amber-50 text-amber-600" :
                item.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                item.color === "blue" ? "bg-blue-50 text-blue-600" :
                "bg-red-50 text-red-600"
              )}>
                <item.icon size={20} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className={cn(
                "text-3xl font-black",
                item.color === "purple" ? "text-purple-900" :
                item.color === "amber" ? "text-amber-600" :
                item.color === "emerald" ? "text-emerald-600" :
                item.color === "blue" ? "text-blue-600" :
                "text-red-600"
              )}>{item.value}</div>
              <span className="text-xs text-slate-400 font-medium">{item.sub}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-purple-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-purple-900">แนวโน้มภาระงาน 12 เดือน</h3>
                <p className="text-xs text-purple-400">เปรียบเทียบงานที่ได้รับมอบหมายและงานที่เสร็จสิ้น</p>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e8ff" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a855f7', fontSize: 12 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a855f7', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#faf5ff' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" name="งานทั้งหมด" fill="#f3e8ff" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="completed" name="เสร็จสิ้น" fill="#9333ea" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <PieChartIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">สัดส่วนสถานะงาน</h3>
              <p className="text-xs text-slate-400">
                {selectedMonth === "all" && selectedYear === "all" 
                  ? "ภาพรวมทั้งหมด" 
                  : `${selectedMonth !== "all" ? monthOptions.find(m => m.value === selectedMonth)?.label : "ทุกเดือน"} ${selectedYear !== "all" ? selectedYear + 543 : "ทุกปี"}`}
              </p>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {stats.statusData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unit Performance Table */}
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Filter size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">ประสิทธิภาพรายหน่วยงาน</h3>
                <p className="text-xs text-slate-400">จำนวนงานและสถานะความล่าช้า</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {stats.unitData.slice(0, 6).map((unit, i) => (
              <div key={i} className="group p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-black/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">{unit.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">{unit.completed}/{unit.total} เสร็จสิ้น</span>
                    {unit.delayed > 0 && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-black rounded-full">ล่าช้า {unit.delayed}</span>
                    )}
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${(unit.completed / (unit.total || 1)) * 100}%` }} 
                  />
                  <div 
                    className="h-full bg-amber-400 transition-all duration-500" 
                    style={{ width: `${(unit.pending / (unit.total || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category/Frequency Breakdown */}
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">แยกตามประเภทความถี่</h3>
              <p className="text-xs text-slate-400">การกระจายตัวของงานตามรอบเวลา</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.freqData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                  {stats.freqData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Type Breakdown */}
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <PieChartIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">แยกตามประเภทงาน</h3>
              <p className="text-xs text-slate-400">สัดส่วนประเภทงานที่ได้รับมอบหมาย</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {stats.typeData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'][i % 4] }} />
                  <span className="text-sm font-medium text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">แยกตามความสำคัญ (Priority)</h3>
              <p className="text-xs text-slate-400">จำนวนงานตามระดับความสำคัญ</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40}>
                  {stats.priorityData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.name.includes("1") ? "#ef4444" : 
                        entry.name.includes("2") ? "#f59e0b" : 
                        "#64748b"
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
