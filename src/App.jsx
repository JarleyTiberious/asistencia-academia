import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import './storage.js';
import {
  Plus, Trash2, Download, Users, CalendarDays, ClipboardList,
  Phone, X, Clock, Pencil, AlertTriangle, CheckCircle2, Loader2, BarChart3, Mic, MicOff, UserX, FileSpreadsheet
} from 'lucide-react';

/* ---------- constants & helpers ---------- */

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const WEEKDAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const SLOTS = ['16:15-17:15', '17:15-18:15', '18:15-19:15', '19:15-20:15', '20:15-21:15'];
const GRACE_MINUTES = 10;

const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const todayISO = () => {
  if (typeof window === 'undefined') return '2026-01-01';
  return toISODate(new Date());
};
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function weekdayIndexFromISO(iso) {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  if (day === 0 || day === 6) return -1;
  return day - 1;
}

function getWeekdayDatesInMonth(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const out = [];
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    const w = d.getDay();
    if (w >= 1 && w <= 5) out.push({ iso: toISODate(d), dayNum: day, weekdayIndex: w - 1, label: WEEKDAY_LABELS[w - 1] });
  }
  return out;
}

const minutesFromTime = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function hoursForRecord(record, slot) {
  if (!record?.checkIn || record.justified) return 0;
  if (record.checkOut) {
    const mins = minutesFromTime(record.checkOut) - minutesFromTime(record.checkIn);
    return mins > 0 ? mins / 60 : 0;
  }
  const [start, end] = slot.split('-');
  const mins = minutesFromTime(end) - minutesFromTime(start);
  return mins > 0 ? mins / 60 : 0;
}

function computeStatus(record, scheduledStart, iso) {
  if (record?.justified) return 'justificado';
  if (record?.markedAbsent) return 'ausente';
  if (record?.checkIn) {
    const sched = minutesFromTime(scheduledStart);
    const actual = minutesFromTime(record.checkIn);
    return actual <= sched + GRACE_MINUTES ? 'a_tiempo' : 'tarde';
  }
  const today = todayISO();
  if (iso < today) return 'ausente';
  if (iso === today) return 'pendiente';
  return 'futuro';
}

const normalizeText = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const ARRIVAL_WORDS = ['ha llegado', 'llego', 'llega', 'presente', 'aqui', 'entrada', 'entro'];
const DEPARTURE_WORDS = ['ha salido', 'salio', 'salida', 'se fue', 'sale'];
const ABSENT_WORDS = ['ausente', 'falta', 'falto', 'no vino', 'no ha venido', 'no asistio'];

function detectVoiceAction(text) {
  const t = normalizeText(text);
  if (ABSENT_WORDS.some(w => t.includes(w))) return 'ausente';
  if (DEPARTURE_WORDS.some(w => t.includes(w))) return 'salida';
  if (ARRIVAL_WORDS.some(w => t.includes(w))) return 'llegada';
  return null;
}

function matchStudentByVoice(text, students) {
  const t = normalizeText(text);
  let best = null, bestLen = 0;
  students.forEach(s => {
    const full = normalizeText(s.name);
    if (full.length >= 3 && t.includes(full) && full.length > bestLen) { best = s; bestLen = full.length; }
    full.split(/\s+/).filter(Boolean).forEach(tok => {
      if (tok.length >= 3 && t.includes(tok) && tok.length > bestLen) { best = s; bestLen = tok.length; }
    });
  });
  return best;
}

const STATUS_META = {
  a_tiempo: { label: 'A tiempo', bg: '#1E7B34', fg: '#E6F4EA' },
  tarde: { label: 'Tarde', bg: '#B5540C', fg: '#FFF1E6' },
  ausente: { label: 'Ausente', bg: '#C92A2A', fg: '#FDEAEA' },
  justificado: { label: 'Justificada', bg: '#44505E', fg: '#EEF0F4' },
  pendiente: { label: 'Pendiente', bg: '#8A6D00', fg: '#FFF9E0' },
  futuro: { label: '—', bg: '#2C3A50', fg: '#A4ACB9' },
  sin_clase: { label: '', bg: 'transparent', fg: '#C7CCD4' },
};

const monthLabel = (yyyymm) => {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const sanitizeSheetName = (name) => name.replace(/[:\\/?*\[\]]/g, '').slice(0, 31) || 'Hoja';

export default function App() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [monthCache, setMonthCache] = useState({});
  const [view, setView] = useState('asistencia');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [newTeacherName, setNewTeacherName] = useState('');
  const emptyStudentForm = { name: '', teacherId: '', phone: '', schedule: [] };
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [scheduleDraft, setScheduleDraft] = useState({ day: 0, slot: SLOTS[0] });
  const [editingStudentId, setEditingStudentId] = useState(null);

  const [attDate, setAttDate] = useState('2026-01-01');
  const [attTeacherFilter, setAttTeacherFilter] = useState('all');
  const [dayEdits, setDayEdits] = useState({});
  const [savingDay, setSavingDay] = useState(false);

  const [monthlyTeacherId, setMonthlyTeacherId] = useState('');
  const [monthlyMonth, setMonthlyMonth] = useState('2026-01');

  const [resumenMonth, setResumenMonth] = useState('2026-01');
  const [resumenTeacherFilter, setResumenTeacherFilter] = useState('all');

  useEffect(() => {
    setIsClient(true);
    const initialToday = todayISO();
    setAttDate(initialToday);
    setMonthlyMonth(initialToday.slice(0, 7));
    setResumenMonth(initialToday.slice(0, 7));
    loadAll();
  }, []);

  useEffect(() => { if (error || info) { const t = setTimeout(() => { setError(null); setInfo(null); }, 4000); return () => clearTimeout(t); } }, [error, info]);
  useEffect(() => { if (isClient) getMonth(attDate.slice(0, 7)); }, [attDate, isClient]);
  useEffect(() => { if (isClient && monthlyMonth) getMonth(monthlyMonth); }, [monthlyMonth, isClient]);
  useEffect(() => { if (isClient && resumenMonth) getMonth(resumenMonth); }, [resumenMonth, isClient]);
  useEffect(() => { if (!monthlyTeacherId && teachers.length) setMonthlyTeacherId(teachers[0].id); }, [teachers]);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        window.storage.get('teachers').catch(() => null),
        window.storage.get('students').catch(() => null),
      ]);
      setTeachers(t ? JSON.parse(t.value) : []);
      setStudents(s ? JSON.parse(s.value) : []);
    } catch (e) {
      setError('No se pudieron cargar los datos guardados.');
    } finally {
      setLoading(false);
    }
  }

  async function persistTeachers(next) {
    setTeachers(next);
    try { await window.storage.set('teachers', JSON.stringify(next)); }
    catch (e) { setError('No se pudo guardar la lista de profes.'); }
  }

  async function persistStudents(next) {
    setStudents(next);
    try { await window.storage.set('students', JSON.stringify(next)); }
    catch (e) { setError('No se pudo guardar la lista de alumnos.'); }
  }

  async function getMonth(yyyymm) {
    if (monthCache[yyyymm]) return monthCache[yyyymm];
    try {
      const res = await window.storage.get(`attendance:${yyyymm}`);
      const data = res ? JSON.parse(res.value) : {};
      setMonthCache(prev => ({ ...prev, [yyyymm]: data }));
      return data;
    } catch (e) {
      setMonthCache(prev => ({ ...prev, [yyyymm]: {} }));
      return {};
    }
  }

  async function saveMonth(yyyymm, data) {
    setMonthCache(prev => ({ ...prev, [yyyymm]: data }));
    try { await window.storage.set(`attendance:${yyyymm}`, JSON.stringify(data)); }
    catch (e) { setError('No se pudo guardar la asistencia.'); }
  }

  const teacherById = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);

  /* ---- excel import ---- */
  function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (teachers.length === 0) {
      setError('Para poder importar alumnos, primero debes añadir al menos un profesor en la columna de la izquierda.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length <= 1) {
          setError('El archivo Excel está vacío o no contiene suficientes filas.');
          return;
        }

        const headerRow = rows[0].map(h => normalizeText(String(h || '')));
        let studentColIdx = headerRow.findIndex(h => h.includes('alumno') || h.includes('nombre') || h.includes('estudiante'));

        if (studentColIdx === -1) {
          studentColIdx = 0;
        }

        const importedStudents = [];
        const defaultTeacher = teachers[0];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawName = row[studentColIdx];
          if (!rawName || !String(rawName).trim()) continue;

          const cleanName = String(rawName).trim();
          if (normalizeText(cleanName) === 'alumno' || normalizeText(cleanName) === 'alumnos' || normalizeText(cleanName) === 'nombre') continue;

          const schedule = [{ day: 0, slot: SLOTS[0] }];

          importedStudents.push({
            id: uid(),
            name: cleanName,
            teacherId: defaultTeacher.id,
            phone: '',
            schedule
          });
        }

        if (importedStudents.length > 0) {
          const finalStudents = [...students, ...importedStudents];
          await persistStudents(finalStudents);
          setInfo(`¡Se han importado ${importedStudents.length} alumnos con éxito! Asignados provisionalmente a ${defaultTeacher.name}.`);
        } else {
          setError('No se pudo extraer ningún nombre del archivo. Asegúrate de que los nombres estén en la primera columna.');
        }
      } catch (err) {
        setError('Error al procesar el archivo Excel. Asegúrate de que es un archivo .xlsx válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---- teacher CRUD ---- */
  function addTeacher() {
    if (!newTeacherName.trim()) return;
    persistTeachers([...teachers, { id: uid(), name: newTeacherName.trim() }]);
    setNewTeacherName('');
  }
  function deleteTeacher(id) {
    if (students.some(s => s.teacherId === id)) { setError('Este profe tiene alumnos asignados. Reasígnalos o elimínalos antes.'); return; }
    persistTeachers(teachers.filter(t => t.id !== id));
  }

  /* ---- student CRUD ---- */
  function addScheduleEntry() {
    setStudentForm(f => {
      if (f.schedule.some(e => e.day === scheduleDraft.day && e.slot === scheduleDraft.slot)) return f;
      return { ...f, schedule: [...f.schedule, { ...scheduleDraft }] };
    });
  }
  function removeScheduleEntry(idx) {
    setStudentForm(f => ({ ...f, schedule: f.schedule.filter((_, i) => i !== idx) }));
  }
  function startEditStudent(s) {
    setStudentForm({ name: s.name, teacherId: s.teacherId, phone: s.phone || '', schedule: [...s.schedule] });
    setEditingStudentId(s.id);
    setView('config');
  }
  function cancelEditStudent() {
    setStudentForm(emptyStudentForm);
    setEditingStudentId(null);
  }
  function submitStudentForm() {
    if (!studentForm.name.trim() || !studentForm.teacherId || studentForm.schedule.length === 0) {
      setError('Completa nombre, profe y al menos un horario.');
      return;
    }
    if (editingStudentId) {
      persistStudents(students.map(s => s.id === editingStudentId ? { ...s, ...studentForm, name: studentForm.name.trim() } : s));
      setInfo('Alumno actualizado.');
    } else {
      persistStudents([...students, { id: uid(), ...studentForm, name: studentForm.name.trim() }]);
      setInfo('Alumno añadido.');
    }
    setStudentForm(emptyStudentForm);
    setEditingStudentId(null);
  }
  function deleteStudent(id) {
    persistStudents(students.filter(s => s.id !== id));
  }

  /* ---- attendance tab ---- */
  const attWeekdayIdx = weekdayIndexFromISO(attDate);
  const attYYYYMM = attDate.slice(0, 7);
  const attRecords = monthCache[attYYYYMM] || {};

  const studentsForDay = useMemo(() => {
    if (attWeekdayIdx < 0) return [];
    return students
      .filter(s => s.schedule.some(e => e.day === attWeekdayIdx))
      .filter(s => attTeacherFilter === 'all' || s.teacherId === attTeacherFilter)
      .map(s => ({ ...s, slot: s.schedule.find(e => e.day === attWeekdayIdx).slot }))
      .sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
  }, [students, attWeekdayIdx, attTeacherFilter]);

  function getDayRecord(studentId) {
    const key = `${studentId}__${attDate}`;
    return dayEdits[key] ?? attRecords[key] ?? {};
  }
  function updateField(studentId, field, value) {
    const key = `${studentId}__${attDate}`;
    setDayEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? attRecords[key] ?? {}), [field]: value } }));
  }
  async function saveDay() {
    if (Object.keys(dayEdits).length === 0) return;
    setSavingDay(true);
    const merged = { ...attRecords, ...dayEdits };
    await saveMonth(attYYYYMM, merged);
    setDayEdits({});
    setSavingDay(false);
    setInfo('Asistencia guardada.');
  }

  /* ---- monthly tab ---- */
  const monthlyDates = useMemo(() => getWeekdayDatesInMonth(monthlyMonth), [monthlyMonth]);
  const monthlyStudents = useMemo(() => students.filter(s => s.teacherId === monthlyTeacherId), [students, monthlyTeacherId]);
  const monthlyRecords = monthCache[monthlyMonth] || {};

  function cellFor(student, date) {
    const entry = student.schedule.find(e => e.day === date.weekdayIndex);
    if (!entry) return { status: 'sin_clase', text: '' };
    const record = monthlyRecords[`${student.id}__${date.iso}`];
    const status = computeStatus(record, entry.slot.split('-')[0], date.iso);
    let text = '';
    if (status === 'a_tiempo' || status === 'tarde') text = `${record.checkIn}–${record.checkOut || '?'}`;
    return { status, text };
  }

  function studentSummary(student) {
    let onTime = 0, late = 0, absent = 0;
    monthlyDates.forEach(date => {
      const entry = student.schedule.find(e => e.day === date.weekdayIndex);
      if (!entry) return;
      const record = monthlyRecords[`${student.id}__${date.iso}`];
      const status = computeStatus(record, entry.slot.split('-')[0], date.iso);
      if (status === 'a_tiempo') onTime++;
      else if (status === 'tarde') late++;
      else if (status === 'ausente') absent++;
    });
    return { onTime, late, absent };
  }

  /* ---- resumen tab ---- */
  const resumenDates = useMemo(() => getWeekdayDatesInMonth(resumenMonth), [resumenMonth]);
  const resumenStudents = useMemo(() => {
    return students.filter(s => resumenTeacherFilter === 'all' || s.teacherId === resumenTeacherFilter);
  }, [students, resumenTeacherFilter]);
  const resumenRecords = monthCache[resumenMonth] || {};

  const absencesByDate = useMemo(() => resumenDates.map(date => {
    let count = 0;
    resumenStudents.forEach(s => {
      const entry = s.schedule.find(e => e.day === date.weekdayIndex);
      if (!entry) return;
      const record = resumenRecords[`${s.id}__${date.iso}`];
      const status = computeStatus(record, entry.slot.split('-')[0], date.iso);
      if (status === 'ausente') count++;
    });
    return { ...date, count };
  }), [resumenDates, resumenStudents, resumenRecords]);

  const totalAbsences = useMemo(() => absencesByDate.reduce((sum, d) => sum + d.count, 0), [absencesByDate]);

  const absencesByWeekday = useMemo(() => WEEKDAY_FULL.map((label, idx) => ({
    label,
    count: absencesByDate.filter(d => d.weekdayIndex === idx).reduce((sum, d) => sum + d.count, 0),
  })), [absencesByDate]);

  const absencesBySlot = useMemo(() => SLOTS.map(slot => {
    let count = 0;
    resumenDates.forEach(date => {
      resumenStudents.forEach(s => {
        const entry = s.schedule.find(e => e.day === date.weekdayIndex);
        if (!entry || entry.slot !== slot) return;
        const record = resumenRecords[`${s.id}__${date.iso}`];
        const status = computeStatus(record, entry.slot.split('-')[0], date.iso);
        if (status === 'ausente') count++;
      });
    });
    return { slot, count };
  }), [resumenDates, resumenStudents, resumenRecords]);

  const teacherDayHours = useMemo(() => teachers.map(t => {
    const tStudents = students.filter(s => s.teacherId === t.id);
    const byDay = WEEKDAY_FULL.map((_, weekdayIdx) => {
      let hours = 0;
      resumenDates.filter(d => d.weekdayIndex === weekdayIdx).forEach(date => {
        tStudents.forEach(s => {
          const entry = s.schedule.find(e => e.day === weekdayIdx);
          if (!entry) return;
          hours += hoursForRecord(resumenRecords[`${s.id}__${date.iso}`], entry.slot);
        });
      });
      return hours;
    });
    return { teacher: t, byDay, total: byDay.reduce((a, b) => a + b, 0) };
  }), [teachers, students, resumenDates, resumenRecords]);

  function buildTeacherSheet(teacher, yyyymm, records) {
    const dates = getWeekdayDatesInMonth(yyyymm);
    const tStudents = students.filter(s => s.teacherId === teacher.id);
    const rows = [];
    const lastCol = dates.length + 3;
    rows.push(['ACADEMIA PIRINEOS']);
    rows.push([`Control de asistencia — ${teacher.name} — ${monthLabel(yyyymm)}`]);
    rows.push([]);
    rows.push(['Alumno', ...dates.map(d => `${d.label} ${d.dayNum}`), 'A tiempo', 'Tardanzas', 'Ausencias']);
    tStudents.forEach(s => {
      let onTime = 0, late = 0, absent = 0;
      const cells = dates.map(date => {
        const entry = s.schedule.find(e => e.day === date.weekdayIndex);
        if (!entry) return '';
        const record = records[`${s.id}__${date.iso}`];
        const status = computeStatus(record, entry.slot.split('-')[0], date.iso);
        if (status === 'a_tiempo') { onTime++; return `${record.checkIn}–${record.checkOut || '?'}`; }
        if (status === 'tarde') { late++; return `${record.checkIn}–${record.checkOut || '?'} (T)`; }
        if (status === 'ausente') { absent++; return 'Ausente'; }
        if (status === 'justificado') return 'Justificada';
        return '';
      });
      rows.push([s.name, ...cells, onTime, late, absent]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    ];
    ws['!cols'] = [{ wch: 26 }, ...dates.map(() => ({ wch: 13 })), { wch: 10 }, { wch: 10 }, { wch: 10 }];
    return ws;
  }

  async function exportTeacherMonth() {
    if (!monthlyTeacherId) { setError('Selecciona un profe primero.'); return; }
    const teacher = teacherById[monthlyTeacherId];
    const records = await getMonth(monthlyMonth);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildTeacherSheet(teacher, monthlyMonth, records), sanitizeSheetName(teacher.name));
    XLSX.writeFile(wb, `Asistencia_${teacher.name.replace(/\s+/g, '_')}_${monthlyMonth}.xlsx`);
    setInfo('Excel descargado.');
  }

  async function exportAllTeachersMonth() {
    if (teachers.length === 0) { setError('Añade al menos un profe primero.'); return; }
    const records = await getMonth(monthlyMonth);
    const wb = XLSX.utils.book_new();
    let any = false;
    teachers.forEach(t => {
      if (students.some(s => s.teacherId === t.id)) {
        XLSX.utils.book_append_sheet(wb, buildTeacherSheet(t, monthlyMonth, records), sanitizeSheetName(t.name));
        any = true;
      }
    });
    if (!any) { setError('No hay alumnos asignados a ningún profe todavía.'); return; }
    XLSX.writeFile(wb, `Asistencia_AcademiaPirineos_${monthlyMonth}.xlsx`);
    setInfo('Excel del mes completo descargado.');
  }

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", background: '#0F172A', minHeight: '100vh', color: '#F8FAFC', paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0F172A; }
        input, select, button { font-family: 'Montserrat', sans-serif; }
        
        .ap-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; border-radius:10px; padding:12px 16px; font-weight:700; font-size:13px; cursor:pointer; transition: all 0.2s ease; min-height: 44px; }
        .ap-btn:hover { opacity:.9; transform: translateY(-1px); }
        .ap-btn:active { transform: translateY(0); }
        .ap-btn-primary { background:#FF6B35; color:#fff; box-shadow: 0 4px 12px rgba(255,107,53,0.25); }
        .ap-btn-navy { background:#1E293B; color:#fff; border: 1px solid #334155; }
        .ap-btn-ghost { background:#1E293B; color:#94A3B8; border:1px solid #334155; }
        .ap-btn-ghost.active { background:#FF6B35; color:#fff; border-color:#FF6B35; }
        .ap-btn-danger { background:rgba(201,42,42,0.1); color:#EF4444; border:1px solid rgba(201,42,42,0.2); }
        .ap-input { background:#1E293B; border:1px solid #334155; border-radius:10px; padding:10px 14px; font-size:13px; color:#F8FAFC; width:100%; min-height: 44px; transition: border-color 0.2s; }
        .ap-input:focus { border-color: #FF6B35; outline: none; }
        
        .ap-card { background:#1E293B; border-radius:16px; padding:20px; border:1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
        .student-mobile-card { background: #111827; border-radius: 12px; padding: 16px; border: 1px solid #1F2937; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; }
        
        .ap-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #334155; background: #1E2937; }
        .ap-table { width:100%; border-collapse:collapse; font-size:13px; text-align: left; }
        .ap-table th { padding:14px 16px; background:#111827; color:#94A3B8; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
        .ap-table td { padding:14px 16px; border-bottom:1px solid #334155; color:#E2E8F0; vertical-align:middle; }
        
        .ap-badge { display:inline-flex; align-items:center; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:800; text-transform: uppercase; letter-spacing: 0.02em; }
        .ap-spin { animation: ap-spin-kf 1s linear infinite; }
        @keyframes ap-spin-kf { to { transform: rotate(360deg); } }

        .config-grid { display: grid; grid-template-columns: 320px 1fr; gap: 24px; }
        .attendance-deck { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

        .nav-desktop { display: flex; gap: 10px; padding: 16px 24px; background: #111827; border-bottom: 1px solid #334155; }
        .nav-mobile { display: none; }

        @media (max-width: 768px) {
          .config-grid { grid-template-columns: 1fr; }
          .nav-desktop { display: none; }
          .nav-mobile { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: #111827; border-top: 1px solid #334155; padding: 10px 14px; justify-content: space-around; z-index: 100; box-shadow: 0 -4px 20px rgba(0,0,0,0.4); }
          .nav-mobile-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: #64748B; font-size: 10px; font-weight: 700; cursor: pointer; }
          .nav-mobile-btn.active { color: #FF6B35; }
          .hide-mobile { display: none !important; }
          .show-mobile-block { display: block !important; }
          .ap-card { padding: 16px; border-radius: 14px; }
        }
      `}</style>

      <div style={{ background: '#111827', padding: '20px 24px', borderBottom: '1px solid #232E42', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.03em', color: '#FF6B35' }}>ACADEMIA PIRINEOS</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: 500 }}>Gestión de Asistencia Profesional</div>
        </div>
      </div>

      <div className="nav-desktop">
        {[
          { key: 'asistencia', label: 'Asistencia Diaria', icon: ClipboardList },
          { key: 'mensual', label: 'Vista Mensual', icon: CalendarDays },
          { key: 'resumen', label: 'Métricas y Resumen', icon: BarChart3 },
          { key: 'config', label: 'Profes y Alumnos', icon: Users },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            className={`ap-btn ${view === tab.key ? 'ap-btn-primary' : 'ap-btn-ghost'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="nav-mobile">
        {[
          { key: 'asistencia', label: 'Asistencia', icon: ClipboardList },
          { key: 'mensual', label: 'Mensual', icon: CalendarDays },
          { key: 'resumen', label: 'Resumen', icon: BarChart3 },
          { key: 'config', label: 'Gestión', icon: Users },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            className={`nav-mobile-btn ${view === tab.key ? 'active' : ''}`}>
            <tab.icon size={22} />
            {tab.label}
          </button>
        ))}
      </div>

      {(error || info) && (
        <div style={{ margin: '16px 24px 0', padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
          background: error ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: error ? '#EF4444' : '#10B981', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
          {error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {error || info}
        </div>
      )}

      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94A3B8', fontSize: 14, justifyContent: 'center', padding: 40 }}>
            <Loader2 size={20} className="ap-spin" /> Cargando base de datos segura…
          </div>
        ) : view === 'config' ? (
          <ConfigView
            teachers={teachers} students={students} teacherById={teacherById}
            newTeacherName={newTeacherName} setNewTeacherName={setNewTeacherName} addTeacher={addTeacher} deleteTeacher={deleteTeacher}
            studentForm={studentForm} setStudentForm={setStudentForm} scheduleDraft={scheduleDraft} setScheduleDraft={setScheduleDraft}
            addScheduleEntry={addScheduleEntry} removeScheduleEntry={removeScheduleEntry}
            editingStudentId={editingStudentId} startEditStudent={startEditStudent} cancelEditStudent={cancelEditStudent}
            submitStudentForm={submitStudentForm} deleteStudent={deleteStudent}
            handleExcelImport={handleExcelImport}
          />
        ) : view === 'asistencia' ? (
          <AttendanceView
            teachers={teachers} attDate={attDate} setAttDate={setAttDate}
            attTeacherFilter={attTeacherFilter} setAttTeacherFilter={setAttTeacherFilter}
            attWeekdayIdx={attWeekdayIdx} studentsForDay={studentsForDay}
            getDayRecord={getDayRecord} updateField={updateField} saveDay={saveDay} savingDay={savingDay}
            dirty={Object.keys(dayEdits).length > 0} teacherById={teacherById} setError={setError}
          />
        ) : view === 'mensual' ? (
          <MonthlyView
            teachers={teachers} monthlyTeacherId={monthlyTeacherId} setMonthlyTeacherId={setMonthlyTeacherId}
            monthlyMonth={monthlyMonth} setMonthlyMonth={setMonthlyMonth}
            monthlyDates={monthlyDates} monthlyStudents={monthlyStudents}
            cellFor={cellFor} studentSummary={studentSummary}
            exportTeacherMonth={exportTeacherMonth} exportAllTeachersMonth={exportAllTeachersMonth}
          />
        ) : (
          <ResumenView
            teachers={teachers} resumenMonth={resumenMonth} setResumenMonth={setResumenMonth}
            resumenTeacherFilter={resumenTeacherFilter} setResumenTeacherFilter={setResumenTeacherFilter}
            absencesByDate={absencesByDate} absencesByWeekday={absencesByWeekday} absencesBySlot={absencesBySlot}
            totalAbsences={totalAbsences} teacherDayHours={teacherDayHours}
          />
        )}
      </div>
    </div>
  );
}

function ConfigView(props) {
  const {
    teachers, students, teacherById, newTeacherName, setNewTeacherName, addTeacher, deleteTeacher,
    studentForm, setStudentForm, scheduleDraft, setScheduleDraft, addScheduleEntry, removeScheduleEntry,
    editingStudentId, startEditStudent, cancelEditStudent, submitStudentForm, deleteStudent, handleExcelImport
  } = props;

  return (
    <div className="config-grid">
      <div className="ap-card" style={{ height: 'fit-content' }}>
        <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#FF6B35' }}>
          <Users size={18} /> Configuración Profes
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="ap-input" placeholder="Ej. Aurora Martín" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTeacher()} />
          <button className="ap-btn ap-btn-primary" style={{ minWidth: 44 }} onClick={addTeacher}><Plus size={16} /></button>
        </div>
        {teachers.length === 0 && <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: '10px 0' }}>No hay profesores registrados.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teachers.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#111827', borderRadius: 10, border: '1px solid #1F2937' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#F1F5F9' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{students.filter(s => s.teacherId === t.id).length} alumnos asignados</div>
              </div>
              <button className="ap-btn ap-btn-danger" style={{ padding: 8, minHeight: 34, minWidth: 34 }} onClick={() => deleteTeacher(t.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="ap-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#FF6B35' }}>
            <Pencil size={18} /> {editingStudentId ? 'Modificar Ficha Alumno' : 'Ficha de Alta Alumno'}
          </div>
          <label className="ap-btn ap-btn-navy" style={{ cursor: 'pointer' }}>
            <FileSpreadsheet size={16} color="#10B981" /> Importar desde Excel
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>Nombre del Alumno</div>
            <input className="ap-input" placeholder="Nombre completo" value={studentForm.name} onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>Profesor Asignado</div>
            <select className="ap-input" value={studentForm.teacherId} onChange={e => setStudentForm(f => ({ ...f, teacherId: e.target.value }))}>
              <option value="">Seleccionar tutor…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>Teléfono de Contacto</div>
            <input className="ap-input" placeholder="Opcional" value={studentForm.phone} onChange={e => setStudentForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        <div style={{ background: '#111827', padding: 14, borderRadius: 12, border: '1px solid #1F2937', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' }}>Planificador de Horario</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="ap-input" style={{ flex: 1, minWidth: 120 }} value={scheduleDraft.day} onChange={e => setScheduleDraft(d => ({ ...d, day: Number(e.target.value) }))}>
              {WEEKDAY_FULL.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            <select className="ap-input" style={{ flex: 1.4, minWidth: 140 }} value={scheduleDraft.slot} onChange={e => setScheduleDraft(d => ({ ...d, slot: e.target.value }))}>
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="ap-btn ap-btn-navy" onClick={addScheduleEntry}><Plus size={14} /> Añadir sesión</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, minHeight: 28 }}>
            {studentForm.schedule.map((e, idx) => (
              <span key={idx} style={{ background: '#1E293B', borderRadius: 8, padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #334155', color: '#E2E8F0', fontWeight: 600 }}>
                {WEEKDAY_FULL[e.day]} · {e.slot}
                <X size={14} style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => removeScheduleEntry(idx)} />
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ap-btn ap-btn-primary" style={{ padding: '12px 24px' }} onClick={submitStudentForm}>{editingStudentId ? 'Guardar Cambios' : 'Dar de Alta Alumno'}</button>
          {editingStudentId && <button className="ap-btn ap-btn-ghost" onClick={cancelEditStudent}>Cancelar</button>}
        </div>

        <div style={{ marginTop: 24, borderTop: '1px solid #334155', paddingTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 12 }}>Alumnos Registrados ({students.length})</div>
          {students.length === 0 && <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: 20 }}>No hay alumnos matriculados en el sistema.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
            {students.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#111827', borderRadius: 10, border: '1px solid #1F2937' }}>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#F8FAFC' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, lineHeight: '1.4' }}>
                    <span style={{ color: '#FF6B35', fontWeight: 600 }}>{teacherById[s.teacherId]?.name || 'Sin tutor'}</span> <br />
                    {s.schedule.map(e => `${WEEKDAY_LABELS[e.day]} ${e.slot.split('-')[0]}`).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="ap-btn ap-btn-ghost" style={{ padding: 8, minHeight: 34, minWidth: 34 }} onClick={() => startEditStudent(s)}><Pencil size={13} /></button>
                  <button className="ap-btn ap-btn-danger" style={{ padding: 8, minHeight: 34, minWidth: 34 }} onClick={() => deleteStudent(s.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceView(props) {
  const { teachers, attDate, setAttDate, attTeacherFilter, setAttTeacherFilter, attWeekdayIdx,
    studentsForDay, getDayRecord, updateField, saveDay, savingDay, dirty, teacherById, setError } = props;

  const [listeningStudentId, setListeningStudentId] = useState(null);
  const [dictationOn, setDictationOn] = useState(false);
  const [voiceLog, setVoiceLog] = useState([]);
  const recognitionRef = useRef(null);
  const dictationOnRef = useRef(false);
  const studentsForDayRef = useRef(studentsForDay);
  studentsForDayRef.current = studentsForDay;

  useEffect(() => () => { if (recognitionRef.current) { dictationOnRef.current = false; recognitionRef.current.stop(); } }, []);

  function pushVoiceLog(name, transcript, ok) {
    setVoiceLog(prev => [{ id: uid(), name, transcript, ok }, ...prev].slice(0, 6));
  }

  function getSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Navegador incompatible con dictado de voz.'); return null; }
    return SR;
  }

  function applyVoiceAction(student, action) {
    if (action === 'llegada') { updateField(student.id, 'checkIn', nowHHMM()); updateField(student.id, 'markedAbsent', false); }
    else if (action === 'salida') { updateField(student.id, 'checkOut', nowHHMM()); }
    else if (action === 'ausente') { updateField(student.id, 'markedAbsent', true); updateField(student.id, 'checkIn', ''); updateField(student.id, 'checkOut', ''); }
  }

  function startRowRecognition(student) {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;
    setListeningStudentId(student.id);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const action = detectVoiceAction(transcript);
      if (action) { applyVoiceAction(student, action); pushVoiceLog(student.name, transcript, true); }
      else { pushVoiceLog(student.name, transcript, false); }
    };
    rec.onerror = () => setListeningStudentId(null);
    rec.onend = () => setListeningStudentId(null);
    try { rec.start(); } catch (err) { setListeningStudentId(null); }
  }

  function toggleDictation() {
    if (dictationOn) {
      dictationOnRef.current = false;
      setDictationOn(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const transcript = e.results[i][0].transcript;
        const action = detectVoiceAction(transcript);
        const student = matchStudentByVoice(transcript, studentsForDayRef.current);
        if (student && action) { applyVoiceAction(student, action); pushVoiceLog(student.name, transcript, true); }
        else { pushVoiceLog(student ? student.name : '—', transcript, false); }
      }
    };
    rec.onerror = () => { dictationOnRef.current = false; setDictationOn(false); };
    rec.onend = () => { if (dictationOnRef.current) { try { rec.start(); } catch (err) {} } };
    recognitionRef.current = rec;
    dictationOnRef.current = true;
    setDictationOn(true);
    try { rec.start(); } catch (err) {}
  }

  return (
    <div className="ap-card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input type="date" className="ap-input" style={{ width: '100%', maxWidth: 170 }} value={attDate} onChange={e => setAttDate(e.target.value)} />
        <select className="ap-input" style={{ width: '100%', maxWidth: 200 }} value={attTeacherFilter} onChange={e => setAttTeacherFilter(e.target.value)}>
          <option value="all">Todos los profesores</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="ap-btn" style={{ background: dictationOn ? '#C92A2A' : '#1E293B', color: '#fff', border: '1px solid #334155' }} onClick={toggleDictation}>
          {dictationOn ? <MicOff size={15} /> : <Mic size={15} />} {dictationOn ? 'Apagar micro' : 'Dictado general'}
        </button>
        <div style={{ flex: '1 1 100%', display: 'block', height: 0, margin: 0 }} className="hide-mobile" />
        <button className="ap-btn ap-btn-primary" style={{ width: '100%', maxWidth: 'fit-content' }} disabled={!dirty || savingDay} onClick={saveDay}>
          {savingDay ? 'Guardando cambios…' : 'Guardar asistencia'}
        </button>
      </div>

      {dictationOn && (
        <div style={{ marginBottom: 16, padding: '12px', borderRadius: 10, background: 'rgba(201,42,42,0.15)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#FCA5A5', fontWeight: 600, border: '1px solid rgba(201,42,42,0.2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#EF4444', display: 'inline-block' }} className="ap-spin" />
          Micrófono activo: Controla por voz diciendo el apellido y "ha llegado" o "ausente".
        </div>
      )}

      {voiceLog.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {voiceLog.map(v => (
            <span key={v.id} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, background: v.ok ? 'rgba(16,185,129,0.15)' : '#111827', color: v.ok ? '#10B981' : '#64748B', fontWeight: 600, border: v.ok ? '1px solid rgba(16,185,129,0.2)' : '1px solid #1F2937' }}>
              {v.ok ? `✓ Interpretado: ${v.name}` : `? No entendido: "${v.transcript}"`}
            </span>
          ))}
        </div>
      )}

      {attWeekdayIdx < 0 ? (
        <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center', padding: 20 }}>No se imparten clases lectivas en fin de semana.</div>
      ) : studentsForDay.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin sesiones programadas para este día o tutor.</div>
      ) : (
        <div className="attendance-deck">
          {studentsForDay.map(s => {
            const rec = getDayRecord(s.id);
            const status = computeStatus(rec, s.slot.split('-')[0], attDate);
            const meta = STATUS_META[status];
            const isListening = listeningStudentId === s.id;
            
            return (
              <div key={s.id} className="ap-card" style={{ background: '#111827', borderColor: isListening ? '#FF6B35' : '#1F2937', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#F8FAFC' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: 600 }}>
                      Tutor: <span style={{ color: '#94A3B8' }}>{teacherById[s.teacherId]?.name}</span> · Hora: <span style={{ color: '#94A3B8' }}>{s.slot}</span>
                    </div>
                  </div>
                  <span className="ap-badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>Entrada</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="time" className="ap-input" style={{ padding: '6px 8px', minHeight: 38 }} value={rec.checkIn || ''} onChange={e => updateField(s.id, 'checkIn', e.target.value)} />
                      <button className="ap-btn ap-btn-navy" style={{ minHeight: 38, padding: 8 }} title="Fijar ahora" onClick={() => updateField(s.id, 'checkIn', nowHHMM())}><Clock size={14} /></button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>Salida</div>
                    <input type="time" className="ap-input" style={{ padding: '6px 8px', minHeight: 38 }} value={rec.checkOut || ''} onChange={e => updateField(s.id, 'checkOut', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #1F2937' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="ap-btn ap-btn-navy" style={{ minHeight: 36, padding: '0 10px', background: isListening ? 'rgba(239,68,68,0.15)' : '#1E293B', borderColor: isListening ? '#EF4444' : '#334155' }} onClick={() => startRowRecognition(s)}>
                      <Mic size={13} color={isListening ? '#EF4444' : '#94A3B8'} /> <span style={{ fontSize: 11, color: isListening ? '#EF4444' : '#94A3B8' }}>{isListening ? 'Grabando...' : 'Voz'}</span>
                    </button>
                    <button className="ap-btn ap-btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => { updateField(s.id, 'markedAbsent', true); updateField(s.id, 'checkIn', ''); updateField(s.id, 'checkOut', ''); }}>
                      <UserX size={13} /> <span style={{ fontSize: 11 }}>Ausente</span>
                    </button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94A3B8', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 16, height: 16, accentColor: '#FF6B35' }} checked={!!rec.justified} onChange={e => updateField(s.id, 'justified', e.target.checked)} />
                    Justificar
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthlyView(props) {
  const { teachers, monthlyTeacherId, setMonthlyTeacherId, monthlyMonth, setMonthlyMonth,
    monthlyDates, monthlyStudents, cellFor, studentSummary, exportTeacherMonth, exportAllTeachersMonth } = props;

  return (
    <div className="ap-card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <select className="ap-input" style={{ width: '100%', maxWidth: 220 }} value={monthlyTeacherId} onChange={e => setMonthlyTeacherId(e.target.value)}>
          <option value="">Filtrar profesor…</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="month" className="ap-input" style={{ width: '100%', maxWidth: 160 }} value={monthlyMonth} onChange={e => setMonthlyMonth(e.target.value)} />
        <div style={{ flex: '1 1 100%', display: 'block', height: 0 }} className="hide-mobile" />
        <button className="ap-btn ap-btn-navy" onClick={exportTeacherMonth}><Download size={14} /> Descargar Profe</button>
        <button className="ap-btn ap-btn-primary" onClick={exportAllTeachersMonth}><Download size={14} /> Descargar Academia</button>
      </div>

      {!monthlyTeacherId ? (
        <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center', padding: 20 }}>Por favor, escoge un tutor arriba para procesar el cuadrante mensual.</div>
      ) : monthlyStudents.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center', padding: 20 }}>No constan registros ni asignaciones con este profesor.</div>
      ) : (
        <div className="ap-table-wrapper">
          <table className="ap-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#111827', zIndex: 10 }}>Alumno</th>
                {monthlyDates.map(d => <th key={d.iso} style={{ textAlign: 'center', minWidth: 90 }}>{d.label} {d.dayNum}</th>)}
                <th style={{ textAlign: 'center' }}>OK</th><th>Tardes</th><th>Faltas</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStudents.map(s => {
                const sum = studentSummary(s);
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, position: 'sticky', left: 0, background: '#1E293B', borderRight: '2px solid #334155', zIndex: 5, fontSize: 13 }}>{s.name}</td>
                    {monthlyDates.map(d => {
                      const c = cellFor(s, d);
                      const meta = STATUS_META[c.status];
                      return (
                        <td key={d.iso} style={{ background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, textAlign: 'center', borderRight: '1px solid #334155' }}>{c.text || '—'}</td>
                      );
                    })}
                    <td style={{ textAlign: 'center', color: '#10B981', fontWeight: 800, fontSize: 14 }}>{sum.onTime}</td>
                    <td style={{ textAlign: 'center', color: '#F59E0B', fontWeight: 800, fontSize: 14 }}>{sum.late}</td>
                    <td style={{ textAlign: 'center', color: '#EF4444', fontWeight: 800, fontSize: 14 }}>{sum.absent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResumenView(props) {
  const { teachers, resumenMonth, setResumenMonth, resumenTeacherFilter, setResumenTeacherFilter,
    absencesByDate, absencesByWeekday, absencesBySlot, totalAbsences, teacherDayHours } = props;

  const maxByDate = Math.max(1, ...absencesByDate.map(d => d.count));
  const maxByWeekday = Math.max(1, ...absencesByWeekday.map(d => d.count));
  const maxBySlot = Math.max(1, ...absencesBySlot.map(d => d.count));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="ap-card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          <input type="month" className="ap-input" style={{ width: '100%', maxWidth: 160 }} value={resumenMonth} onChange={e => setResumenMonth(e.target.value)} />
          <select className="ap-input" style={{ width: '100%', maxWidth: 200 }} value={resumenTeacherFilter} onChange={e => setResumenTeacherFilter(e.target.value)}>
            <option value="all">Filtro global profes</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ textAlign: 'right', minWidth: 140 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Faltas Mensuales</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>{totalAbsences}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div className="ap-card">
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14, color: '#FF6B35' }}>Ausencias por Jornada</div>
          {absencesByDate.length === 0 ? (
            <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>Sin métricas acumuladas.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {absencesByDate.map(d => (
                <div key={d.iso} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div style={{ width: 54, color: '#94A3B8', fontWeight: 600 }}>{d.label} {d.dayNum}</div>
                  <div style={{ flex: 1, background: '#111827', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.count / maxByDate) * 100}%`, background: '#EF4444', height: '100%' }} />
                  </div>
                  <div style={{ width: 16, textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{d.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="ap-card">
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#94A3B8' }}>Faltas según Día Semanal</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {absencesByWeekday.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div style={{ width: 74, color: '#94A3B8', fontWeight: 600 }}>{d.label}</div>
                  <div style={{ flex: 1, background: '#111827', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.count / maxByWeekday) * 100}%`, background: '#475569', height: '100%' }} />
                  </div>
                  <div style={{ width: 16, textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{d.count}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="ap-card">
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#FF6B35' }}>Faltas según Tramo Horario</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {absencesBySlot.map(d => (
                <div key={d.slot} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div style={{ width: 88, color: '#94A3B8', fontWeight: 600 }}>{d.slot}</div>
                  <div style={{ flex: 1, background: '#111827', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.count / maxBySlot) * 100}%`, background: '#FF6B35', height: '100%' }} />
                  </div>
                  <div style={{ width: 16, textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{d.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="ap-card">
        <div style={{ fontWeight: 700, fontSize: 14, color: '#F8FAFC' }}>Horas Docentes Efectivas Asistidas</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16, marginTop: 2 }}>Cómputo acumulado en base a registros de check-in y check-out firmados</div>
        {teacherDayHours.length === 0 ? (
          <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>Sin datos consolidados.</div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="ap-table">
              <thead><tr><th>Profesor</th>{WEEKDAY_FULL.map(d => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}<th style={{ textAlign: 'center' }}>Total</th></tr></thead>
              <tbody>
                {teacherDayHours.map(({ teacher, byDay, total }) => (
                  <tr key={teacher.id}>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>{teacher.name}</td>
                    {byDay.map((h, i) => (
                      <td key={i} style={{ textAlign: 'center' }}>
                        {h > 0 ? <span style={{ background: 'rgba(51,65,85,0.4)', color: '#38BDF8', borderRadius: 6, padding: '4px 10px', fontWeight: 700, border: '1px solid #334155' }}>{h.toFixed(1)}h</span> : <span style={{ color: '#475569' }}>—</span>}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#FF6B35', fontSize: 14 }}>{total.toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
