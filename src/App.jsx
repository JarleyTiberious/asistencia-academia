import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  UserPlus, 
  GraduationCap, 
  FileSpreadsheet,
  Menu,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function App() {
  // --- ESTADOS DE LA APLICACIÓN ---
  const [profesores, setProfesores] = useState([]);
  const [profesorActivo, setProfesorActivo] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [asistencias, setAsistencias] = useState({});
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  // Modos de vista y control responsive
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [nuevoProfeNombre, setNuevoProfeNombre] = useState('');
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('');
  const [nuevoAlumnoGrupo, setNuevoAlumnoGrupo] = useState('B1');

  // --- CARGA INICIAL DESDE FIREBASE ---
  useEffect(() => {
    async function cargarDatos() {
      if (window.storage) {
        const datosProfes = await window.storage.get('profesores');
        const datosAlumnos = await window.storage.get('alumnos');
        const datosAsistencias = await window.storage.get('asistencias');

        if (datosProfes) setProfesores(datosProfes);
        if (datosAlumnos) setAlumnos(datosAlumnos);
        if (datosAsistencias) setAsistencias(datosAsistencias);
        
        if (datosProfes && datosProfes.length > 0) {
          setProfesorActivo(datosProfes[0]);
        }
      }
    }
    cargarDatos();
  }, []);

  // --- SCONCRÉCION Y GUARDADO AUTOMÁTICO ---
  const guardarEnFirebase = async (clave, datos) => {
    if (window.storage) {
      await window.storage.set(clave, datos);
    }
  };

  // --- ACCIONES DE GESTIÓN ---
  const agregarProfesor = () => {
    if (!nuevoProfeNombre.trim()) return;
    const nuevos = [...profesores, nuevoProfeNombre.trim()];
    setProfesores(nuevos);
    guardarEnFirebase('profesores', nuevos);
    if (!profesorActivo) setProfesorActivo(nuevoProfeNombre.trim());
    setNuevoProfeNombre('');
  };

  const eliminarProfesor = (profe) => {
    const nuevos = profesores.filter(p => p !== profe);
    setProfesores(nuevos);
    guardarEnFirebase('profesores', nuevos);
    if (profesorActivo === profe) setProfesorActivo(nuevos[0] || null);
  };

  const agregarAlumno = () => {
    if (!nuevoAlumnoNombre.trim() || !profesorActivo) return;
    const nuevo = {
      id: Date.now().toString(),
      nombre: nuevoAlumnoNombre.trim(),
      grupo: nuevoAlumnoGrupo,
      profesor: profesorActivo
    };
    const nuevos = [...alumnos, nuevo];
    setAlumnos(nuevos);
    guardarEnFirebase('alumnos', nuevos);
    setNuevoAlumnoNombre('');
  };

  const eliminarAlumno = (id) => {
    const nuevos = alumnos.filter(a => a.id !== id);
    setAlumnos(nuevos);
    guardarEnFirebase('alumnos', nuevos);
  };

  const marcarAsistencia = (alumnoId, estado) => {
    const claveHistorial = `${fechaSeleccionada}_${alumnoId}`;
    const nuevas = {
      ...asistencias,
      [claveHistorial]: {
        estado,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    };
    setAsistencias(nuevas);
    guardarEnFirebase('asistencias', nuevas);
  };

  // --- IMPORTACIÓN MASIVA DESDE EXCEL ---
  const importarExcel = (e) => {
    const file = e.target.files[0];
    if (!file || !profesorActivo) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const listaJSON = XLSX.utils.sheet_to_json(sheet);

      const nuevosAlumnos = listaJSON.map((item, index) => ({
        id: `excel_${Date.now()}_${index}`,
        nombre: item.Nombre || item.nombre || "Alumno Anónimo",
        grupo: item.Grupo || item.grupo || "B2",
        profesor: profesorActivo
      }));

      const listaActualizada = [...alumnos, ...nuevosAlumnos];
      setAlumnos(listaActualizada);
      guardarEnFirebase('alumnos', listaActualizada);
    };
    reader.readAsBinaryString(file);
  };

  // --- FILTROS ---
  const alumnosFiltrados = alumnos.filter(a => a.profesor === profesorActivo);

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] antialiased font-sans">
      
      {/* HEADER PRINCIPAL CORPORATIVO */}
      <header className="bg-[#1E293B] border-b border-[#334155] sticky top-0 z-50 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#FF6B35] p-2 rounded-lg text-white font-black text-xl tracking-wider">AP</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Academia Pirineos</h1>
              <p className="text-xs text-[#94A3B8]">Control de Asistencia Profesional</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => setVistaAdmin(!vistaAdmin)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                vistaAdmin 
                  ? 'bg-[#334155] text-[#F8FAFC] border border-[#475569]' 
                  : 'bg-[#FF6B35] text-white hover:bg-[#e05626]'
              }`}
            >
              {vistaAdmin ? '📊 Pasar Asistencia' : '⚙️ Configuración / Profesores'}
            </button>
          </div>

          <button className="md:hidden text-[#94A3B8]" onClick={() => setMenuAbierto(!menuAbierto)}>
            {menuAbierto ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* MENÚ RESPONSIVE MÓVIL */}
      {menuAbierto && (
        <div className="md:hidden bg-[#1E293B] border-b border-[#334155] p-4 flex flex-col gap-3">
          <button 
            onClick={() => { setVistaAdmin(!vistaAdmin); setMenuAbierto(false); }}
            className="w-full bg-[#FF6B35] text-white p-3 rounded-lg font-semibold text-center"
          >
            {vistaAdmin ? '📊 Pasar Asistencia' : '⚙️ Configuración y Profesores'}
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* PANEL LATERAL: SELECCIÓN DE PROFESOR */}
        <section className="lg:col-span-1 bg-[#1E293B] border border-[#334155] rounded-xl p-4 shadow-sm h-fit">
          <h2 className="text-sm font-bold tracking-wider text-[#94A3B8] uppercase mb-3 flex items-center gap-2">
            <Users size={16} className="text-[#FF6B35]" /> Profesores Activos
          </h2>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {profesores.map((profe) => (
              <button
                key={profe}
                onClick={() => setProfesorActivo(profe)}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-150 flex justify-between items-center ${
                  profesorActivo === profe
                    ? 'bg-[#FF6B35] text-white font-bold shadow-md'
                    : 'bg-[#0F172A] text-[#94A3B8] hover:bg-[#1f293d] border border-[#334155]'
                }`}
              >
                <span>{profe}</span>
                {vistaAdmin && (
                  <Trash2 
                    size={16} 
                    className="text-red-400 hover:text-red-600 cursor-pointer" 
                    onClick={(e) => { e.stopPropagation(); eliminarProfesor(profe); }}
                  />
                )}
              </button>
            ))}
            {profesores.length === 0 && (
              <p className="text-sm text-[#94A3B8] italic text-center py-4">No hay profesores creados.</p>
            )}
          </div>
        </section>

        {/* CONTENIDO PRINCIPAL DINÁMICO */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          
          {/* MODO CONFIGURACIÓN / ADMINISTRACIÓN */}
          {vistaAdmin ? (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 shadow-sm flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Añadir Nuevo Profesor</h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ej. Aurora, Alberto, Lucía..."
                    value={nuevoProfeNombre}
                    onChange={(e) => setNuevoProfeNombre(e.target.value)}
                    className="flex-1 bg-[#0F172A] text-[#F8FAFC] border border-[#334155] rounded-lg p-3 outline-none"
                  />
                  <button onClick={agregarProfesor} className="bg-[#FF6B35] text-white px-5 rounded-lg font-bold hover:bg-[#e05626]">
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="border-t border-[#334155] pt-6">
                <h3 className="text-lg font-bold text-white mb-2">Importar Alumnos desde Excel</h3>
                <p className="text-sm text-[#94A3B8] mb-4">
                  Selecciona un archivo <strong>.xlsx</strong> que contenga las columnas <code>Nombre</code> y <code>Grupo</code> (B1, B2, C1). Se asignarán automáticamente a <strong>{profesorActivo || 'ningún profesor seleccionado'}</strong>.
                </p>
                <label className={`flex items-center justify-center gap-3 border-2 border-dashed border-[#475569] p-6 rounded-xl cursor-pointer hover:bg-[#0F172A] transition-colors ${!profesorActivo && 'opacity-50 cursor-not-allowed'}`}>
                  <FileSpreadsheet className="text-[#FF6B35]" size={28} />
                  <span className="font-semibold text-sm text-[#F8FAFC]">Cargar archivo Excel de alumnos</span>
                  <input type="file" accept=".xlsx" onChange={importarExcel} disabled={!profesorActivo} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            
            /* MODO CONTROL DE ASISTENCIA DIARIA */
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 md:p-6 shadow-sm flex flex-col gap-4">
              
              {/* SELECTOR DE FECHA Y ALTA DE ALUMNO DIRECTO */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0F172A] p-4 rounded-xl border border-[#334155]">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Calendar className="text-[#FF6B35]" size={20} />
                  <input 
                    type="date" 
                    value={fechaSeleccionada}
                    onChange={(e) => setFechaSeleccionada(e.target.value)}
                    className="bg-[#1E293B] text-white border border-[#334155] rounded-lg p-2 font-bold outline-none"
                  />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <input 
                    type="text" 
                    placeholder="Nuevo alumno..."
                    value={nuevoAlumnoNombre}
                    onChange={(e) => setNuevoAlumnoNombre(e.target.value)}
                    className="flex-1 md:w-64 bg-[#1E293B] text-white border border-[#334155] rounded-lg p-2 text-sm outline-none"
                  />
                  <select 
                    value={nuevoAlumnoGrupo} 
                    onChange={(e) => setNuevoAlumnoGrupo(e.target.value)}
                    className="bg-[#1E293B] text-white border border-[#334155] rounded-lg p-2 text-sm outline-none font-bold"
                  >
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                  </select>
                  <button onClick={agregarAlumno} className="bg-[#FF6B35] text-white px-4 rounded-lg font-bold hover:bg-[#e05626]">
                    <UserPlus size={16} />
                  </button>
                </div>
              </div>

              {/* LISTADO DE ASISTENCIA */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#334155] text-[#94A3B8] text-xs uppercase tracking-wider">
                      <th className="py-3 px-2">Alumno</th>
                      <th className="py-3 px-2 text-center">Nivel</th>
                      <th className="py-3 px-2 text-center">Acciones de Asistencia</th>
                      <th className="py-3 px-2 text-center">Estado</th>
                      <th className="py-3 px-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]">
                    {alumnosFiltrados.map((alumno) => {
                      const historial = asistencias[`${fechaSeleccionada}_${alumno.id}`];
                      return (
                        <tr key={alumno.id} className="hover:bg-[#243147] transition-colors">
                          <td className="py-4 px-2 font-semibold text-white">{alumno.nombre}</td>
                          <td className="py-4 px-2 text-center">
                            <span className="bg-[#0F172A] text-[#FF6B35] border border-[#FF6B35]/30 text-xs px-2 py-1 rounded font-black">
                              {alumno.grupo}
                            </span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={() => marcarAsistencia(alumno.id, 'PRESENTE')}
                                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                                  historial?.estado === 'PRESENTE'
                                    ? 'bg-green-600 text-white shadow-md scale-105'
                                    : 'bg-[#0F172A] text-green-400 hover:bg-green-950/40 border border-green-900'
                                }`}
                              >
                                <CheckCircle size={14} /> PRESENTE
                              </button>
                              <button 
                                onClick={() => marcarAsistencia(alumno.id, 'AUSENTE')}
                                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                                  historial?.estado === 'AUSENTE'
                                    ? 'bg-red-600 text-white shadow-md scale-105'
                                    : 'bg-[#0F172A] text-red-400 hover:bg-red-950/40 border border-red-900'
                                }`}
                              >
                                <XCircle size={14} /> AUSENTE
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            {historial ? (
                              <div className="flex flex-col items-center">
                                <span className={`text-xs font-black ${historial.estado === 'PRESENTE' ? 'text-green-400' : 'text-red-400'}`}>
                                  {historial.estado}
                                </span>
                                <span className="text-[10px] text-[#94A3B8] flex items-center gap-1 mt-0.5">
                                  <Clock size={10} /> {historial.hora}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#475569] italic">Sin registro</span>
                            )}
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button onClick={() => eliminarAlumno(alumno.id)} className="text-[#475569] hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {alumnosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-sm text-[#94A3B8] italic text-center py-8">
                          No hay alumnos registrados con este profesor. ¡Importa un Excel o añádelos arriba!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
