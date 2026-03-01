import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Calendar, 
  User, 
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { Task, UNITS } from "../types";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";

interface TaskTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskTable({ tasks, onEdit, onDelete }: TaskTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            task.responsible.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUnit = unitFilter === "ทั้งหมด" || task.unit === unitFilter;
      const matchesStatus = statusFilter === "ทั้งหมด" || task.status === statusFilter;
      return matchesSearch && matchesUnit && matchesStatus;
    });
  }, [tasks, searchTerm, unitFilter, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ก่อนเวลา": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "ตรงเวลา": return "bg-blue-100 text-blue-700 border-blue-200";
      case "ล่าช้า": return "bg-red-100 text-red-700 border-red-200";
      case "รอดำเนินการ": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "d MMM yy", { locale: th });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
      {/* Filters */}
      <div className="p-6 border-b border-black/5 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="ค้นหาชื่องาน หรือ ผู้รับผิดชอบ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-600"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400 w-5 h-5" />
          <select 
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="bg-slate-50 border border-black/5 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none"
          >
            <option value="ทั้งหมด">ทุกหน่วยงาน</option>
            {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-black/5 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none"
          >
            <option value="ทั้งหมด">ทุกสถานะ</option>
            <option value="ก่อนเวลา">ก่อนเวลา</option>
            <option value="ตรงเวลา">ตรงเวลา</option>
            <option value="ล่าช้า">ล่าช้า</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ชื่องาน / หน่วยงาน</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ผู้รับผิดชอบ / ความถี่</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">กำหนดเสร็จ</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ทำเสร็จจริง</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ช้า/เร็ว (วัน)</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">สถานะ</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 group-hover:text-slate-700 transition-colors">{task.name}</span>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                        <Building2 size={12} />
                        {task.unit}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <User size={14} className="text-slate-400" />
                        {task.responsible}
                      </div>
                      <span className="text-xs text-slate-400 mt-1">{task.frequency}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(task.plannedDate)}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(task.actualDate)}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "text-sm font-mono font-bold",
                      task.delayDays > 0 ? "text-red-500" : task.delayDays < 0 ? "text-emerald-500" : "text-slate-400"
                    )}>
                      {task.delayDays > 0 ? `+${task.delayDays}` : task.delayDays}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-bold border",
                      getStatusColor(task.status)
                    )}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEdit(task)}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl border border-transparent hover:border-black/5 transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(task.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl border border-transparent hover:border-black/5 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                  ไม่พบข้อมูลงานที่ค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Placeholder */}
      <div className="p-6 border-t border-black/5 flex items-center justify-between">
        <span className="text-sm text-slate-500">แสดง {filteredTasks.length} รายการ</span>
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl disabled:opacity-30" disabled>
            <ChevronLeft size={20} />
          </button>
          <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl disabled:opacity-30" disabled>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
