export type TaskStatus = "ก่อนเวลา" | "ตรงเวลา" | "ล่าช้า" | "รอดำเนินการ";

export interface Task {
  id: string;
  groupId: string; // To link tasks assigned together
  name: string;
  unit: string;
  responsible: string;
  frequency: string;
  plannedDate: string; // YYYY-MM-DD
  actualDate: string;  // YYYY-MM-DD or empty
  delayDays: number;
  status: TaskStatus;
  remarks: string;
  createdAt: string;
}

export const UNITS = [
  "แผนก", "หน่วย 1", "หน่วย 2", "หน่วย 3", "หน่วย 4", "หน่วย 5",
  "หน่วย 6", "หน่วย 7", "หน่วย 8", "หน่วย 9", "หน่วย 10", "หน่วย 11"
];

export const FREQUENCIES = ["ทุกวัน", "ทุกสัปดาห์", "เดือนละ 1 ครั้ง", "ไตรมาสละ 1 ครั้ง", "รายปี", "รายครั้ง"];
