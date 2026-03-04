import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, FileText, User, Building2, Calendar, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "../lib/utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Task, UNITS, FREQUENCIES, TaskStatus, TASK_TYPES, PRIORITIES } from "../types";
import { differenceInDays, format, isValid, parseISO } from "date-fns";
import { th } from "date-fns/locale";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  editingTask: Task | null;
}

export default function TaskForm({ isOpen, onClose, onSave, editingTask }: TaskFormProps) {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([UNITS[0]]);
  const [formData, setFormData] = useState<Partial<Task>>({
    name: "",
    unit: UNITS[0],
    responsible: "",
    frequency: FREQUENCIES[0],
    type: TASK_TYPES[0],
    priority: PRIORITIES[2],
    plannedDate: format(new Date(), "yyyy-MM-dd"),
    actualDate: "",
    detailedSteps: "",
    remarks: "",
    status: "รอดำเนินการ",
    delayDays: 0
  });

  useEffect(() => {
    if (editingTask) {
      setFormData(editingTask);
      setSelectedUnits([editingTask.unit]);
    } else {
      setFormData({
        name: "",
        unit: UNITS[0],
        responsible: "",
        frequency: FREQUENCIES[0],
        type: TASK_TYPES[0],
        priority: PRIORITIES[2],
        plannedDate: format(new Date(), "yyyy-MM-dd"),
        actualDate: "",
        detailedSteps: "",
        remarks: "",
        status: "รอดำเนินการ",
        delayDays: 0
      });
      setSelectedUnits([UNITS[0]]);
    }
  }, [editingTask, isOpen]);

  const calculateStatus = (planned: string, actual: string): { status: TaskStatus; delay: number } => {
    if (!actual) return { status: "รอดำเนินการ", delay: 0 };
    
    const pDate = parseISO(planned);
    const aDate = parseISO(actual);
    
    if (!isValid(pDate) || !isValid(aDate)) return { status: "รอดำเนินการ", delay: 0 };
    
    const diff = differenceInDays(aDate, pDate);
    
    let status: TaskStatus = "ตรงเวลา";
    if (diff > 0) status = "ล่าช้า";
    else if (diff < 0) status = "ก่อนเวลา";
    
    return { status, delay: diff };
  };

  const handleDateChange = (field: "plannedDate" | "actualDate", date: Date | null) => {
    const dateStr = date ? format(date, "yyyy-MM-dd") : "";
    const newFormData = { ...formData, [field]: dateStr };
    
    const { status, delay } = calculateStatus(
      field === "plannedDate" ? dateStr : (formData.plannedDate || ""),
      field === "actualDate" ? dateStr : (formData.actualDate || "")
    );
    
    setFormData({ ...newFormData, status, delayDays: delay });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const unitsToAssign = selectedUnits;
    
    if (!editingTask?.id && unitsToAssign.length > 1) {
      const groupId = `G-${Date.now()}`;
      const tasks = unitsToAssign.map(unit => ({
        ...formData,
        id: `T-${unit}-${Date.now()}`,
        groupId,
        unit,
        status: "รอดำเนินการ"
      }));
      onSave(tasks as any);
    } else {
      // If only one unit selected or editing
      onSave({
        ...formData,
        unit: editingTask?.id ? formData.unit : unitsToAssign[0]
      });
    }
  };

  const toggleUnit = (unit: string) => {
    setSelectedUnits(prev => 
      prev.includes(unit) 
        ? (prev.length > 1 ? prev.filter(u => u !== unit) : prev)
        : [...prev, unit]
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl border border-black/5 overflow-hidden"
          >
            <div className="p-8 border-b border-black/5 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                  <FileText className="text-white w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingTask?.id ? "แก้ไขรายการงาน" : editingTask ? "ส่งต่องาน / คัดลอก" : "เพิ่มรายการงานใหม่"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {editingTask?.id ? "แก้ไขข้อมูลงานเดิม" : "สร้างงานใหม่จากข้อมูลเดิมเพื่อเริ่มขั้นตอนถัดไป"}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-black/5"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> ชื่องาน
                </label>
                <input 
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น ตรวจสอบระบบไฟฟ้าประจำเดือน..."
                  className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium"
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={14} /> หน่วยงานที่รับผิดชอบ
                </label>
                
                {editingTask?.id ? (
                  <select 
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium appearance-none"
                  >
                    {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-2xl border border-black/5 transition-all">
                    {UNITS.map(unit => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => toggleUnit(unit)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                          selectedUnits.includes(unit) 
                            ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                            : "bg-white text-slate-500 border-black/5 hover:border-slate-300"
                        )}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> ผู้รับผิดชอบ
                </label>
                <input 
                  required
                  type="text"
                  value={formData.responsible}
                  onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                  placeholder="ระบุชื่อ-นามสกุล (หากมีหลายคนให้คั่นด้วยเครื่องหมาย ,)"
                  className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} /> ประเภทงาน
                  </label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium appearance-none"
                  >
                    {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={14} /> ความสำคัญ (Priority)
                  </label>
                  <select 
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium appearance-none"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} /> ความถี่
                  </label>
                  <select 
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium appearance-none"
                  >
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={14} /> กำหนดแล้วเสร็จ
                  </label>
                  <DatePicker
                    selected={formData.plannedDate ? parseISO(formData.plannedDate) : null}
                    onChange={(date) => handleDateChange("plannedDate", date)}
                    dateFormat="dd/MM/yyyy"
                    locale={th}
                    className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} /> ทำเสร็จจริง
                  </label>
                  <DatePicker
                    selected={formData.actualDate ? parseISO(formData.actualDate) : null}
                    onChange={(date) => handleDateChange("actualDate", date)}
                    dateFormat="dd/MM/yyyy"
                    locale={th}
                    isClearable
                    placeholderText="ยังไม่เสร็จ"
                    className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={14} /> สถานะอัตโนมัติ
                  </label>
                  <div className="px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl flex items-center justify-between">
                    <span className={cn(
                      "font-bold",
                      formData.status === "ล่าช้า" ? "text-red-500" : formData.status === "ก่อนเวลา" ? "text-emerald-500" : formData.status === "ตรงเวลา" ? "text-blue-500" : "text-slate-400"
                    )}>
                      {formData.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formData.delayDays! > 0 ? `ช้า ${formData.delayDays} วัน` : formData.delayDays! < 0 ? `เร็ว ${Math.abs(formData.delayDays!)} วัน` : "ตรงเวลา"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> Update ขั้นตอนการดำเนินงานอย่างละเอียดว่าถึงขึ้นตอนใด
                </label>
                <textarea 
                  value={formData.detailedSteps}
                  onChange={(e) => setFormData({ ...formData, detailedSteps: e.target.value })}
                  placeholder="ระบุว่าปัจจุบันงานดำเนินถึงขั้นตอนใด..."
                  className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> หมายเหตุ
                </label>
                <textarea 
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="ระบุข้อมูลเพิ่มเติม..."
                  className="w-full px-5 py-4 bg-slate-50 border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-700 font-medium min-h-[100px]"
                />
              </div>
            </form>

            <div className="p-8 bg-slate-50/50 border-t border-black/5 flex items-center justify-end gap-4">
              <button 
                type="button"
                onClick={onClose}
                className="px-8 py-4 text-slate-500 font-bold hover:text-slate-900 transition-all"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSubmit}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
              >
                {editingTask?.id ? "บันทึกการแก้ไข" : "ยืนยันการส่งต่อ / บันทึก"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
