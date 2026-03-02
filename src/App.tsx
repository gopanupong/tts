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
import Login from "./components/Login";

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
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [user, setUser] = useState<string | null>(() => localStorage.getItem("employeeId"));

  const logActivity = async (action: string, details: string) => {
    if (!user) return;
    try {
      await axios.post("/api/logs", {
        employeeId: user,
        action,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  const handleLogin = (employeeId: string) => {
    setUser(employeeId);
    localStorage.setItem("employeeId", employeeId);
    logActivity("LOGIN", `เข้าสู่ระบบด้วยรหัสพนักงาน ${employeeId}`);
  };

  const handleLogout = () => {
    logActivity("LOGOUT", `ออกจากระบบรหัสพนักงาน ${user}`);
    setUser(null);
    localStorage.removeItem("employeeId");
  };

  const checkGoogleStatus = async () => {
    try {
      const { data } = await axios.get("/api/google/status");
      setIsGoogleConnected(data.connected);
    } catch (err) {
      console.error("Failed to check Google status");
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const { data } = await axios.get("/api/auth/google/url");
      const authWindow = window.open(data.url, "google_auth", "width=600,height=700");
      if (!authWindow) {
        alert("กรุณาอนุญาตให้เปิดหน้าต่าง Pop-up เพื่อเชื่อมต่อ Google");
      }
    } catch (err) {
      setError("ไม่สามารถดึง URL สำหรับเชื่อมต่อ Google ได้");
    }
  };

  const handleSyncToSheets = async () => {
    setLoading(true);
    try {
      await axios.post("/api/google/sheets/sync");
      logActivity("SYNC_SHEETS", "ซิงค์ข้อมูลลง Google Sheets");
      alert("ซิงค์ข้อมูลลง Google Sheets สำเร็จ!");
    } catch (err: any) {
      setError(err.response?.data?.error || "การซิงค์ข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    checkGoogleStatus();
  }, []);

  const handleAddTask = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleHandover = (task: Task) => {
    // Transform name: if it contains "จัดทำ", replace with "ตรวจ"
    let newName = task.name;
    if (newName.includes("จัดทำ")) {
      newName = newName.replace("จัดทำ", "ตรวจ");
    } else {
      newName = `[ส่งต่อ] ${task.name}`;
    }

    // Create a new task based on the completed one
    const handoverTask: Partial<Task> = {
      name: newName,
      unit: "แผนก", // Default handover to "แผนก"
      responsible: task.responsible,
      frequency: task.frequency,
      plannedDate: new Date().toISOString().split('T')[0],
      actualDate: "",
      status: "รอดำเนินการ",
      detailedSteps: `รับช่วงต่อจากงาน: ${task.name}\nหน่วยงานเดิม: ${task.unit}\nเสร็จสิ้นเมื่อ: ${task.actualDate}`,
      remarks: `ส่งต่อมาจาก: ${task.name} (${task.unit})\nงานเดิมเสร็จจริงวันที่: ${task.actualDate}`,
      sourceTaskId: task.id,
      sourceTaskName: task.name,
    };
    
    setEditingTask(handoverTask as Task);
    setIsFormOpen(true);
    logActivity("HANDOVER_INIT", `เริ่มส่งต่องานจาก: ${task.name} (${task.unit})`);
  };

  const handleSaveTask = async (taskData: any) => {
    setLoading(true);
    try {
      if (Array.isArray(taskData)) {
        // Batch assignment
        await axios.post("/api/tasks/batch", { tasks: taskData });
        logActivity("CREATE_BATCH", `เพิ่มงานใหม่แบบกลุ่มจำนวน ${taskData.length} รายการ`);
      } else {
        // Single update or create
        const isNew = !taskData.id;
        const task = {
          ...taskData,
          id: taskData.id || `T-${Date.now()}`,
        };
        await axios.post("/api/tasks", task);
        logActivity(isNew ? "CREATE" : "UPDATE", `${isNew ? "เพิ่ม" : "แก้ไข"}งาน: ${task.name} (${task.unit})`);
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

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-purple-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-purple-100 flex flex-col">
        <div className="p-6 border-b border-purple-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <FileSpreadsheet className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-purple-900">TaskTracker</span>
          </div>
          
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                activeTab === "dashboard" ? "bg-purple-600 text-white shadow-lg" : "text-purple-600/60 hover:bg-purple-50"
              )}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab("tasks")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                activeTab === "tasks" ? "bg-purple-600 text-white shadow-lg" : "text-purple-600/60 hover:bg-purple-50"
              )}
            >
              <ListTodo size={20} />
              <span className="font-medium">รายการงาน</span>
            </button>
          </nav>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-end gap-4">
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">ผู้ใช้งาน</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                {user.slice(-2)}
              </div>
              <span className="text-xs font-bold text-purple-900">ID: {user}</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
          >
            <LogOut size={20} />
            <span>ออกจากระบบ</span>
          </button>

          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">สถานะระบบ</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-purple-600">เชื่อมต่อฐานข้อมูลแล้ว</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-purple-900">
              {activeTab === "dashboard" ? "ภาพรวมการดำเนินงาน" : "จัดการรายการงาน"}
            </h2>
            <p className="text-purple-500">
              {activeTab === "dashboard" ? "สรุปสถานะงานของทุกหน่วยงาน" : "เพิ่ม แก้ไข และติดตามสถานะงานรายหน่วย"}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {isGoogleConnected ? (
              <button 
                onClick={handleSyncToSheets}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                ซิงค์ Google Sheets
              </button>
            ) : (
              <button 
                onClick={handleConnectGoogle}
                className="bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                เชื่อมต่อ Google Sheets
              </button>
            )}
            {activeTab === "tasks" && (
              <button 
                onClick={handleAddTask}
                className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-semibold hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20"
              >
                <Plus size={20} />
                เพิ่มงานใหม่
              </button>
            )}
            <button 
              onClick={fetchTasks}
              disabled={loading}
              className="p-3 bg-white border border-purple-100 rounded-2xl text-purple-600 hover:bg-purple-50 transition-all disabled:opacity-50"
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
                onHandover={handleHandover}
                onDelete={async (id) => {
                  const taskToDelete = tasks.find(t => t.id === id);
                  if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้?")) return;
                  setLoading(true);
                  try {
                    await axios.delete(`/api/tasks/${id}`);
                    logActivity("DELETE", `ลบงาน: ${taskToDelete?.name || id} (${taskToDelete?.unit || "ไม่ระบุ"})`);
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
