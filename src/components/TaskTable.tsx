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
  MoreHorizontal,
  X,
  ArrowRightCircle,
  Link2
} from "lucide-react";
import { Task, UNITS, FREQUENCIES } from "../types";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TaskTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onHandover: (task: Task) => void;
}

export default function TaskTable({ tasks, onEdit, onDelete, onHandover }: TaskTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  const [frequencyFilter, setFrequencyFilter] = useState("ทั้งหมด");
  const [groupBy, setGroupBy] = useState<"none" | "unit" | "status">("none");
  
  // Date Range Filters
  const [plannedStartDate, setPlannedStartDate] = useState<Date | null>(null);
  const [plannedEndDate, setPlannedEndDate] = useState<Date | null>(null);
  const [actualStartDate, setActualStartDate] = useState<Date | null>(null);
  const [actualEndDate, setActualEndDate] = useState<Date | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            task.responsible.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            task.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (task.detailedSteps && task.detailedSteps.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesUnit = unitFilter === "ทั้งหมด" || task.unit === unitFilter;
      const matchesStatus = statusFilter === "ทั้งหมด" || task.status === statusFilter;
      const matchesFrequency = frequencyFilter === "ทั้งหมด" || task.frequency === frequencyFilter;
      
      // Date Range Filtering
      let matchesPlannedRange = true;
      if (plannedStartDate || plannedEndDate) {
        if (!task.plannedDate) {
          matchesPlannedRange = false;
        } else {
          const pDate = parseISO(task.plannedDate);
          if (plannedStartDate && pDate < startOfDay(plannedStartDate)) matchesPlannedRange = false;
          if (plannedEndDate && pDate > endOfDay(plannedEndDate)) matchesPlannedRange = false;
        }
      }

      let matchesActualRange = true;
      if (actualStartDate || actualEndDate) {
        if (!task.actualDate) {
          matchesActualRange = false;
        } else {
          const aDate = parseISO(task.actualDate);
          if (actualStartDate && aDate < startOfDay(actualStartDate)) matchesActualRange = false;
          if (actualEndDate && aDate > endOfDay(actualEndDate)) matchesActualRange = false;
        }
      }

      return matchesSearch && matchesUnit && matchesStatus && matchesFrequency && matchesPlannedRange && matchesActualRange;
    });
  }, [tasks, searchTerm, unitFilter, statusFilter, frequencyFilter, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate]);

  const groupedTasks: Record<string, Task[]> = useMemo(() => {
    if (groupBy === "none") return { "รายการทั้งหมด": filteredTasks };
    
    return filteredTasks.reduce((acc, task) => {
      const key = groupBy === "unit" ? task.unit : task.status;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [filteredTasks, groupBy]);

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
    <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
      {/* Filters */}
      <div className="p-6 border-b border-purple-100 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="ค้นหาชื่องาน, ผู้รับผิดชอบ, หน่วยงาน หรือขั้นตอน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-purple-50 border border-purple-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600/10 transition-all text-purple-900"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="text-purple-400 w-5 h-5" />
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">จัดกลุ่มตาม</span>
              <select 
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-2 text-sm font-medium text-purple-900 focus:outline-none"
              >
                <option value="none">ไม่จัดกลุ่ม</option>
                <option value="unit">หน่วยงาน</option>
                <option value="status">สถานะ</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">หน่วยงาน</span>
              <select 
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-2 text-sm font-medium text-purple-900 focus:outline-none"
              >
                <option value="ทั้งหมด">ทุกหน่วยงาน</option>
                {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">ความถี่</span>
              <select 
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
                className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-2 text-sm font-medium text-purple-900 focus:outline-none"
              >
                <option value="ทั้งหมด">ทุกความถี่</option>
                {FREQUENCIES.map(freq => <option key={freq} value={freq}>{freq}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">สถานะ</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-2 text-sm font-medium text-purple-900 focus:outline-none"
              >
                <option value="ทั้งหมด">ทุกสถานะ</option>
                <option value="ก่อนเวลา">ก่อนเวลา</option>
                <option value="ตรงเวลา">ตรงเวลา</option>
                <option value="ล่าช้า">ล่าช้า</option>
                <option value="รอดำเนินการ">รอดำเนินการ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap items-end gap-6 p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={12} /> ช่วงเวลากำหนดเสร็จ
            </span>
            <div className="flex items-center gap-2">
              <DatePicker
                selected={plannedStartDate}
                onChange={(date) => setPlannedStartDate(date)}
                selectsStart
                startDate={plannedStartDate}
                endDate={plannedEndDate}
                placeholderText="เริ่มต้น"
                dateFormat="dd/MM/yyyy"
                locale={th}
                className="w-32 px-3 py-2 bg-white border border-purple-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <span className="text-purple-300 text-xs">-</span>
              <DatePicker
                selected={plannedEndDate}
                onChange={(date) => setPlannedEndDate(date)}
                selectsEnd
                startDate={plannedStartDate}
                endDate={plannedEndDate}
                minDate={plannedStartDate || undefined}
                placeholderText="สิ้นสุด"
                dateFormat="dd/MM/yyyy"
                locale={th}
                className="w-32 px-3 py-2 bg-white border border-purple-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              {(plannedStartDate || plannedEndDate) && (
                <button 
                  onClick={() => { setPlannedStartDate(null); setPlannedEndDate(null); }}
                  className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={12} /> ช่วงเวลาทำเสร็จจริง
            </span>
            <div className="flex items-center gap-2">
              <DatePicker
                selected={actualStartDate}
                onChange={(date) => setActualStartDate(date)}
                selectsStart
                startDate={actualStartDate}
                endDate={actualEndDate}
                placeholderText="เริ่มต้น"
                dateFormat="dd/MM/yyyy"
                locale={th}
                className="w-32 px-3 py-2 bg-white border border-purple-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <span className="text-purple-300 text-xs">-</span>
              <DatePicker
                selected={actualEndDate}
                onChange={(date) => setActualEndDate(date)}
                selectsEnd
                startDate={actualStartDate}
                endDate={actualEndDate}
                minDate={actualStartDate || undefined}
                placeholderText="สิ้นสุด"
                dateFormat="dd/MM/yyyy"
                locale={th}
                className="w-32 px-3 py-2 bg-white border border-purple-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              {(actualStartDate || actualEndDate) && (
                <button 
                  onClick={() => { setActualStartDate(null); setActualEndDate(null); }}
                  className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
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
            {Object.keys(groupedTasks).length > 0 ? (
              Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
                <React.Fragment key={groupName}>
                  {groupBy !== "none" && (
                    <tr className="bg-purple-50/30">
                      <td colSpan={7} className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                          <span className="text-sm font-black text-purple-900">{groupName}</span>
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-100/50 px-2 py-0.5 rounded-full">
                            {groupTasks.length} รายการ
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {groupTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 group-hover:text-slate-700 transition-colors">{task.name}</span>
                            {task.sourceTaskId && (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold border border-blue-100 shrink-0">
                                <Link2 size={10} />
                                รับช่วงต่อ
                              </div>
                            )}
                          </div>
                          {task.sourceTaskId && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-400 font-medium">
                                จาก: {task.sourceTaskName}
                              </span>
                              {tasks.find(t => t.id === task.sourceTaskId)?.actualDate && (
                                <span className="text-[9px] text-slate-400 italic">
                                  (ต้นฉบับเสร็จเมื่อ: {formatDate(tasks.find(t => t.id === task.sourceTaskId)?.actualDate || "")})
                                </span>
                              )}
                            </div>
                          )}
                          {task.detailedSteps && (
                            <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic">{task.detailedSteps}</span>
                          )}
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                            <Building2 size={12} />
                            {task.unit}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700">
                            <User size={14} className="text-slate-400 shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {task.responsible.split(',').map((name, idx) => (
                                <span key={idx} className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                  {name.trim()}
                                </span>
                              ))}
                            </div>
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
                            title="แก้ไข"
                          >
                            <Edit2 size={16} />
                          </button>
                          {task.actualDate && (
                            <button 
                              onClick={() => onHandover(task)}
                              className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-transparent hover:border-emerald-100 transition-all"
                              title="ส่งต่องานให้แผนก"
                            >
                              <ArrowRightCircle size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => onDelete(task.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl border border-transparent hover:border-black/5 transition-all"
                            title="ลบ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
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
