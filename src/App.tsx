import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  ListTodo, 
  Plus, 
  Settings, 
  LogOut, 
  FileSpreadsheet,
  ChevronRight,
  Search,
  Filter,
  AlertCircle
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from "axios";
import { Task, UNITS } from "./types";
import Dashboard from "./components/Dashboard";
import TaskTable from "./components/TaskTable";
import TaskForm from "./components/TaskForm";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks">("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get("/api/tasks");
      setTasks(data);
    } catch (err: any) {
      setError("Failed to fetch tasks from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleSaveTask = async (taskData: any) => {
    setLoading(true);
    try {
      if (Array.isArray(taskData)) {
        // Batch assignment
        await axios.post("/api/tasks/batch", { tasks: taskData });
      } else {
        // Single update or create
        const task = {
          ...taskData,
          id: taskData.id || `T-${Date.now()}`,
        };
        await axios.post("/api/tasks", task);
      }
      await fetchTasks();
      setIsFormOpen(false);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "Failed to save task";
      setError(message);
      console.error("Save Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-black/5 flex flex-col">
        <div className="p-6 border-b border-black/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900">TaskTracker</span>
          </div>
          
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                activeTab === "dashboard" ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab("tasks")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                activeTab === "tasks" ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <ListTodo size={20} />
              <span className="font-medium">รายการงาน</span>
            </button>
          </nav>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-end">
          <div className="p-4 bg-slate-50 rounded-2xl border border-black/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">สถานะระบบ</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-slate-600">เชื่อมต่อฐานข้อมูลแล้ว</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {activeTab === "dashboard" ? "ภาพรวมการดำเนินงาน" : "จัดการรายการงาน"}
            </h2>
            <p className="text-slate-500">
              {activeTab === "dashboard" ? "สรุปสถานะงานของทั้ง 11 หน่วยงาน" : "เพิ่ม แก้ไข และติดตามสถานะงานรายหน่วย"}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {activeTab === "tasks" && (
              <button 
                onClick={handleAddTask}
                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <Plus size={20} />
                เพิ่มงานใหม่
              </button>
            )}
            <button 
              onClick={fetchTasks}
              disabled={loading}
              className="p-3 bg-white border border-black/5 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <Settings size={20} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Dashboard tasks={tasks} />
            </motion.div>
          ) : (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <TaskTable 
                tasks={tasks} 
                onEdit={handleEditTask}
                onDelete={async (id) => {
                  if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้?")) return;
                  setLoading(true);
                  try {
                    await axios.delete(`/api/tasks/${id}`);
                    await fetchTasks();
                  } catch (err) {
                    setError("Failed to delete task");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <TaskForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSave={handleSaveTask}
        editingTask={editingTask}
      />
    </div>
  );
}
