import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function App() {
  // --- ESTADOS INICIALES DESDE LOCALSTORAGE ---
  const [profesores, setProfesores] = useState(() => {
    const locales = localStorage.getItem('profesores');
    return locales ? JSON.parse(locales) : [];
  });

  const [profesorActivo, setProfesorActivo] = useState(() => {
    const locales = localStorage.getItem('profesores');
    if (locales) {
      const parsed = JSON.parse(locales);
      return parsed.length > 0 ? parsed[0] : null;
    }
    return null;
  });

  const [alumnos, setAlumnos] = useState(() => {
    const locales = localStorage.getItem('alumnos');
    return locales ? JSON.parse(locales) : [];
  });

  const [asistencias, setAsistencias] = useState(() => {
    const locales = localStorage.getItem('asistencias');
    return locales ? JSON.parse(locales) : {};
  });

  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  const [horaSeleccionada, setHoraSeleccionada] = useState('16:15-17:15');
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const [nuevoProfeNombre, setNuevoProfeNombre] = useState('');
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('');
  const [nuevoAlumnoGrupo, setNuevoAlumnoGrupo] = useState('B2');

  const [mesCuadrante, setMesCuadrante] = useState(new Date().getMonth() + 1); 
  const [anioCuadrante, setAnioCuadrante] = useState(new Date().getFullYear());
  
  const obtenerDiaSemanaClave = (fechaStr) => {
    const partes = fechaStr.split('-');
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    const numeroDia = fecha.getDay(); 
    
    if (numeroDia === 1 || numeroDia === 3) return "L-X"; 
    if (numeroDia === 2 || numeroDia === 4) return "M-J"; 
    if (numeroDia === 5) return "V"; 
    return "L-X"; 
  };

  const [nuevoAlumnoDias, setNuevoAlumnoDias] = useState(() => obtenerDiaSemanaClave(new Date().toISOString().split('T')[0])); 
  const [diaFiltroTabla, setDiaFiltroTabla] = useState(() => obtenerDiaSemanaClave(new Date().toISOString().split('T')[0]));

  const nivelesAcademia = [
    "Primaria", "ESO", "Bachillerato", "PAU", 
    "Mayores 25", "Acceso Grado", "B1", "B2", "C1", "APTIS"
  ];

  const horariosAcademia = [
    "16:15-17:15",
    "17:15-18:15",
    "19:15-20:15",
    "20:15-21:15"
  ];

  const opcionesDias = [
    { clave: "L-X", texto: "Lunes y Miércoles" },
    { clave: "M-J", texto: "Martes y Jueves" },
    { clave: "V", texto: "Viernes" },
    { clave: "L-M-X-J-V", texto: "Lunes a Viernes" }
  ];

  const mesesAnio = [
    { valor: 1, nombre: "Enero" }, { valor: 2, nombre: "Febrero" }, { valor: 3, nombre: "Marzo" },
    { valor: 4, nombre: "Abril" }, { valor: 5, nombre: "Mayo" }, { valor: 6, nombre: "Junio" },
    { valor: 7, nombre: "Julio" }, { valor: 8, nombre: "Agosto" }, { valor: 9, nombre: "Septiembre" },
    { valor: 10, nombre: "Octubre" }, { valor: 11, nombre: "Noviembre" }, { valor: 12, nombre: "Diciembre" }
  ];

  useEffect(() => {
    async function sincronizarConFirebase() {
      if (window.storage) {
        try {
          const datosProfes = await window.storage.get('profesores');
          const datosAlumnos = await window.storage.get('alumnos');
          const datosAsistencias = await window.storage.get('asistencias');

          if (datosProfes && Array.isArray(datosProfes) && datosProfes.length > 0) {
            setProfesores(datosProfes);
            localStorage.setItem('profesores', JSON.stringify(datosProfes));
          }
          if (datosAlumnos && Array.isArray(datosAlumnos) && datosAlumnos.length > 0) {
            setAlumnos(datosAlumnos);
            localStorage.setItem('alumnos', JSON.stringify(datosAlumnos));
          }
          if (datosAsistencias && Object.keys(datosAsistencias).length > 0) {
            setAsistencias(datosAsistencias);
            localStorage.setItem('asistencias', JSON.stringify(datosAsistencias));
          }
        } catch (error) {
          console.error("Firebase offline.", error);
        }
      }
    }
    sincronizarConFirebase();
  }, []);

  useEffect(() => {
    const diaDetectado = obtenerDiaSemanaClave(fechaSeleccionada);
    setNuevoAlumnoDias(diaDetectado);
    setDiaFiltroTabla(diaDetectado);
    
    const partes = fechaSeleccionada.split('-');
    setAnioCuadrante(parseInt(partes[0]));
    setMesCuadrante(parseInt(partes[1]));
  }, [fechaSeleccionada]);

  const guardarDatos = async (clave, nuevosDatos) => {
    localStorage.setItem(clave, JSON.stringify(nuevosDatos));
    if (window.storage) {
      await window.storage.set(clave, nuevosDatos);
    }
  };

  const cambiarNivelAlumno = (id, nuevoNivel) => {
    const listaActualizada = alumnos.map(al => al.id === id ? { ...al, grupo: nuevoNivel } : al);
    setAlumnos(listaActualizada);
    guardarDatos('alumnos', listaActualizada);
  };

  const cambiarHorarioAlumno = (id, nuevoHorario) => {
    const listaActualizada = alumnos.map(al => al.id === id ? { ...al, horario: nuevoHorario } : al);
    setAlumnos(listaActualizada);
    guardarDatos('alumnos', listaActualizada);
  };

  const cambiarDiasAlumno = (id, nuevosDias) => {
    const listaActualizada = alumnos.map(al => al.id === id ? { ...al, dias: nuevosDias } : al);
    setAlumnos(listaActualizada);
    guardarDatos('alumnos', listaActualizada);
  };

  const agregarAlumno = () => {
    if (!nuevoAlumnoNombre.trim() || !profesorActivo) return;
    const nuevo = {
      id: Date.now().toString(),
      nombre: nuevoAlumnoNombre.trim(),
      grupo: nuevoAlumnoGrupo,
      profesor: profesorActivo,
      horario: horaSeleccionada,
      dias: nuevoAlumnoDias 
    };
    const nuevos = [...alumnos, nuevo];
    setAlumnos(nuevos);
    guardarDatos('alumnos', nuevos);
    setDiaFiltroTabla(nuevoAlumnoDias);
    setNuevoAlumnoNombre('');
  };

  const eliminarAlumno = (id) => {
    if (window.confirm("¿Seguro que quieres eliminar a este alumno de la lista?")) {
      const nuevos = alumnos.filter(a => a.id !== id);
      setAlumnos(nuevos);
      guardarDatos('alumnos', nuevos);
    }
  };

  const marcarAsistencia = (alumnoId, estado) => {
    const claveHistorial = `${fechaSeleccionada}_${horaSeleccionada}_${alumnoId}`;
    const nuevas = {
      ...asistencias,
      [claveHistorial]: {
        estado,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    };
    setAsistencias(nuevas);
    guardarDatos('asistencias', nuevas);
  };

  const agregarProfesor = () => {
    if (!nuevoProfeNombre.trim()) return;
    const nuevos = [...profesores, nuevoProfeNombre.trim()];
    setProfesores(nuevos);
    guardarDatos('profesores', nuevos);
    if (!profesorActivo) setProfesorActivo(nuevoProfeNombre.trim());
    setNuevoProfeNombre('');
  };

  const eliminarProfesor = (profe) => {
    const nuevos = profesores.filter(p => p !== profe);
    setProfesores(nuevos);
    guardarDatos('profesores', nuevos);
    if (profesorActivo === profe) setProfesorActivo(nuevos[0] || null);
  };

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
      const nuevosAlumnos = listaJSON.map((item, index) => {
        const nombreDetectado = item.Nombre || item.nombre || item.Alumno || item.alumno || item["Nombre Alumno"] || item["Apellidos y Nombre"];
        const grupoDetectado = item.Grupo || item.grupo || item.Nivel || item.nivel || "B2";
        const horarioDetectado = item.Horario || item.horario || item.Hora || item.hora || horaSeleccionada;
        const diasDetectados = item.Dias || item.dias || item.Días || item.días || obtenerDiaSemanaClave(fechaSeleccionada);
        
        return {
          id: `excel_${Date.now()}_${index}`,
          nombre: nombreDetectado ? nombreDetectado.toString().trim() : "Alumno Anónimo",
          grupo: grupoDetectado.toString().trim(),
          profesor: profesorActivo,
          horario: horarioDetectado.toString().trim(),
          dias: diasDetectados.toString().trim()
        };
      });
      const listaActualizada = [...alumnos, ...nuevosAlumnos];
      setAlumnos(listaActualizada);
      guardarDatos('alumnos', listaActualizada);
    };
    reader.readAsBinaryString(file);
  };

  // --- FUNCIÓN PARA EXPORTAR EL CUADRANTE A EXCEL ---
  const exportarExcelMensual = () => {
    if (!profesorActivo || alumnosDelProfesor.length === 0) {
      alert("No hay alumnos para exportar.");
      return;
    }

    // 1. Preparamos las cabeceras del Excel
    const cabeceras = ["Alumno", "Nivel", "Horario", "Días", ...arregloDias];
    
    // 2. Rellenamos las filas con los datos y las asistencias
    const filas = alumnosDelProfesor.map(alumno => {
      const filaAlumno = [
        alumno.nombre, 
        alumno.grupo, 
        alumno.horario || '', 
        alumno.dias || ''
      ];

      arregloDias.forEach(dia => {
        const mmStr = mesCuadrante < 10 ? `0${mesCuadrante}` : mesCuadrante;
        const ddStr = dia < 10 ? `0${dia}` : dia;
        const fechaCelda = `${anioCuadrante}-${mmStr}-${ddStr}`;
        
        let registroEncontrado = null;
        for (const horaPosible of horariosAcademia) {
          const claveBuscada = `${fechaCelda}_${horaPosible}_${alumno.id}`;
          if (asistencias[claveBuscada]) {
            registroEncontrado = asistencias[claveBuscada];
            break;
          }
        }
        
        if (!registroEncontrado && alumno.horario) {
          const claveEspecial = `${fechaCelda}_${alumno.horario}_${alumno.id}`;
          if (asistencias[claveEspecial]) {
            registroEncontrado = asistencias[claveEspecial];
          }
        }

        let estadoStr = "-";
        if (registroEncontrado?.estado === 'PRESENTE') estadoStr = "PRESENTE";
        if (registroEncontrado?.estado === 'AUSENTE') estadoStr = "AUSENTE";

        filaAlumno.push(estadoStr);
      });

      return filaAlumno;
    });

    // 3. Generamos y descargamos el archivo usando SheetJS
    const datosExcel = [cabeceras, ...filas];
    const hoja = XLSX.utils.aoa_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Asistencia Mensual");

    const nombreMes = mesesAnio.find(m => m.valor === mesCuadrante).nombre;
    const nombreArchivo = `Asistencia_${profesorActivo}_${nombreMes}_${anioCuadrante}.xlsx`;
    
    XLSX.writeFile(libro, nombreArchivo);
  };

  const totalDiasMes = new Date(anioCuadrante, mesCuadrante, 0).getDate();
  const arregloDias = Array.from({ length: totalDiasMes }, (_, i) => i + 1);

  const alumnosFiltrados = alumnos.filter(a => {
    if (a.profesor !== profesorActivo) return false;
    if (!a.horario || !a.dias) return true;
    const coincideHora = a.horario === horaSeleccionada;
    const coincideDia = a.dias === diaFiltroTabla || a.dias === 'L-M-X-J-V';
    return coincideHora && coincideDia;
  });

  const alumnosDelProfesor = alumnos.filter(a => a.profesor === profesorActivo);
  
  const tarjetaEstilo = { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' };
  const inputEstilo = { backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '10px', borderRadius: '8px', outline: 'none' };
  const botonNaranja = { backgroundColor: '#ff6b35', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
  const botonVerde = { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ ...tarjetaEstilo, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 5px 0' }}>ACADEMIA PIRINEOS</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Control de Asistencia Profesional Avanzado</p>
        </div>
        <div>
          <button onClick={() => setVistaAdmin(!vistaAdmin)} style={{ ...botonNaranja, backgroundColor: vistaAdmin ? '#475569' : '#ff6b35' }}>
            {vistaAdmin ? '📊 Pasar Asistencia' : '⚙️ Gestionar Profes y Excel'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        <div style={tarjetaEstilo}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Profesores Activos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profesores.map(p => (
              <div 
                key={p} 
                onClick={() => setProfesorActivo(p)}
                style={{ padding: '12px 15px', backgroundColor: p === profesorActivo ? '#ff6b35' : '#0f172a', color: p === profesorActivo ? 'white' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}
              >
                <span>{p}</span>
                {vistaAdmin && <span onClick={(e) => { e.stopPropagation(); eliminarProfesor(p); }} style={{ color: '#ef4444', cursor: 'pointer' }}>✕</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {vistaAdmin ? (
            <div style={tarjetaEstilo}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Añadir Nuevo Profesor</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                <input type="text" placeholder="Nombre..." value={nuevoProfeNombre} onChange={(e) => setNuevoProfeNombre(e.target.value)} style={{ ...inputEstilo, flex: 1 }} />
                <button onClick={agregarProfesor} style={botonNaranja}>+ Añadir</button>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', borderTop: '1px solid #334155', paddingTop: '20px' }}>Importar Alumnos</h3>
              <input type="file" accept=".xlsx" onChange={importarExcel} disabled={!profesorActivo} style={{ color: '#94a3b8', fontSize: '14px' }} />
            </div>
          ) : (
            <>
              <div style={tarjetaEstilo}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold' }} />
                    <select value={horaSeleccionada} onChange={(e) => setHoraSeleccionada(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold', borderColor: '#ff6b35' }}>
                      {horariosAcademia.map(h => <option key={h} value={h}>🕒 {h}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="text" placeholder="Nuevo alumno..." value={nuevoAlumnoNombre} onChange={(e) => setNuevoAlumnoNombre(e.target.value)} style={inputEstilo} />
                    
                    <select value={nuevoAlumnoGrupo} onChange={(e) => setNuevoAlumnoGrupo(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold' }}>
                      {nivelesAcademia.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                    </select>

                    <select value={nuevoAlumnoDias} onChange={(e) => setNuevoAlumnoDias(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold', borderColor: '#10b981' }}>
                      {opcionesDias.map(opt => <option key={opt.clave} value={opt.clave}>{opt.texto}</option>)}
                    </select>

                    <button onClick={agregarAlumno} style={botonNaranja}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px 15px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>👁️ Pasar lista de:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {opcionesDias.map(opt => (
                      <button key={opt.clave} onClick={() => setDiaFiltroTabla(opt.clave)} style={{ backgroundColor: diaFiltroTabla === opt.clave ? '#10b981' : '#1e293b', color: 'white', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{opt.clave}</button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '13px' }}>
                        <th style={{ padding: '12px' }}>Alumno</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Nivel</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Horario</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Días</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Borrar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosFiltrados.map(a => {
                        const historial = asistencias[`${fechaSeleccionada}_${horaSeleccionada}_${a.id}`];
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #334155' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>
                              {a.nombre}
                              {(!a.horario || !a.dias) && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#ef4444' }}>(Incompleto)</span>}
                            </td>
                            
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select value={a.grupo} onChange={(e) => cambiarNivelAlumno(a.id, e.target.value)} style={{ backgroundColor: '#0f172a', color: '#ff6b35', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ff6b35', fontSize: '12px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {nivelesAcademia.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select value={a.horario || ''} onChange={(e) => cambiarHorarioAlumno(a.id, e.target.value)} style={{ backgroundColor: '#0f172a', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', border: '1px solid #38bdf8', fontSize: '12px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {!a.horario && <option value="" disabled>Sin hora</option>}
                                {horariosAcademia.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select value={a.dias || ''} onChange={(e) => cambiarDiasAlumno(a.id, e.target.value)} style={{ backgroundColor: '#0f172a', color: '#10b981', padding: '6px 10px', borderRadius: '6px', border: '1px solid #10b981', fontSize: '12px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {!a.dias && <option value="" disabled>Sin días</option>}
                                {opcionesDias.map(o => <option key={o.clave} value={o.clave}>{o.clave}</option>)}
                              </select>
                            </td>

                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button onClick={() => marcarAsistencia(a.id, 'PRESENTE')} style={{ backgroundColor: historial?.estado === 'PRESENTE' ? '#16a34a' : '#0f172a', color: historial?.estado === 'PRESENTE' ? 'white' : '#4ade80', border: '1px solid #16a34a', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✓ PRESENTE</button>
                                <button onClick={() => marcarAsistencia(a.id, 'AUSENTE')} style={{ backgroundColor: historial?.estado === 'AUSENTE' ? '#dc2626' : '#0f172a', color: historial?.estado === 'AUSENTE' ? 'white' : '#f87171', border: '1px solid #dc2626', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✕ AUSENTE</button>
                              </div>
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                              {historial ? (
                                <span style={{ fontWeight: 'bold', color: historial.estado === 'PRESENTE' ? '#4ade80' : '#f87171' }}>{historial.estado}</span>
                              ) : <span style={{ color: '#475569', fontStyle: 'italic' }}>-</span>}
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button onClick={() => eliminarAlumno(a.id)} style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }} title="Eliminar alumno">
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {alumnosFiltrados.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '20px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                            No hay alumnos asignados a este horario o día de asistencia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CUADRANTE MENSUAL CON EXPORTACIÓN */}
              <div style={tarjetaEstilo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '15px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>📅 Cuadrante de Asistencia Mensual</h2>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>Muestra las asistencias generales sin importar la hora seleccionada arriba</p>
                  </div>
                  
                  {/* SECCIÓN DERECHA: SELECTORES + BOTÓN DESCARGA EXCEL */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={exportarExcelMensual} style={botonVerde} title="Descargar este mes en Excel">
                      ⬇️ Descargar Excel
                    </button>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={mesCuadrante} onChange={(e) => setMesCuadrante(parseInt(e.target.value))} style={inputEstilo}>
                        {mesesAnio.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
                      </select>
                      <select value={anioCuadrante} onChange={(e) => setAnioCuadrante(parseInt(e.target.value))} style={inputEstilo}>
                        {[2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                        <th style={{ padding: '10px', textAlign: 'left', minWidth: '160px', border: '1px solid #334155' }}>Alumno</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #334155' }}>Clase</th>
                        {arregloDias.map(dia => (
                          <th key={dia} style={{ padding: '5px 2px', textAlign: 'center', minWidth: '24px', border: '1px solid #334155', backgroundColor: '#1e293b' }}>
                            {dia}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosDelProfesor.map(alumno => (
                        <tr key={alumno.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #334155' }}>{alumno.nombre}</td>
                          <td style={{ padding: '8px 4px', color: '#ff6b35', fontSize: '10px', textAlign: 'center', border: '1px solid #334155' }}>
                            {alumno.dias} <br/> <span style={{ color: '#38bdf8' }}>{alumno.horario ? alumno.horario.split('-')[0] : ''}</span>
                          </td>
                          {arregloDias.map(dia => {
                            const mmStr = mesCuadrante < 10 ? `0${mesCuadrante}` : mesCuadrante;
                            const ddStr = dia < 10 ? `0${dia}` : dia;
                            const fechaCelda = `${anioCuadrante}-${mmStr}-${ddStr}`;
                            
                            let registroEncontrado = null;
                            for (const horaPosible of horariosAcademia) {
                              const claveBuscada = `${fechaCelda}_${horaPosible}_${alumno.id}`;
                              if (asistencias[claveBuscada]) {
                                registroEncontrado = asistencias[claveBuscada];
                                break;
                              }
                            }
                            
                            if (!registroEncontrado && alumno.horario) {
                              const claveEspecial = `${fechaCelda}_${alumno.horario}_${alumno.id}`;
                              if (asistencias[claveEspecial]) {
                                registroEncontrado = asistencias[claveEspecial];
                              }
                            }

                            let renderEstado = "-";
                            if (registroEncontrado?.estado === 'PRESENTE') renderEstado = "🟢";
                            if (registroEncontrado?.estado === 'AUSENTE') renderEstado = "🔴";

                            return (
                              <td key={dia} style={{ textAlign: 'center', padding: '4px 0', border: '1px solid #334155', fontSize: '11px' }}>
                                {renderEstado}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', fontSize: '12px', color: '#94a3b8' }}>
                  <span>🟢 = Presente</span>
                  <span>🔴 = Ausente</span>
                  <span>- = Sin registro</span>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function App() {
  // --- ESTADOS INICIALES DESDE LOCALSTORAGE ---
  const [profesores, setProfesores] = useState(() => {
    const locales = localStorage.getItem('profesores');
    return locales ? JSON.parse(locales) : [];
  });

  const [profesorActivo, setProfesorActivo] = useState(() => {
    const locales = localStorage.getItem('profesores');
    if (locales) {
      const parsed = JSON.parse(locales);
      return parsed.length > 0 ? parsed[0] : null;
    }
    return null;
  });

  const [alumnos, setAlumnos] = useState(() => {
    const locales = localStorage.getItem('alumnos');
    return locales ? JSON.parse(locales) : [];
  });

  const [asistencias, setAsistencias] = useState(() => {
    const locales = localStorage.getItem('asistencias');
    return locales ? JSON.parse(locales) : {};
  });

  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  const [horaSeleccionada, setHoraSeleccionada] = useState('16:15-17:15');
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const [nuevoProfeNombre, setNuevoProfeNombre] = useState('');
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('');
  const [nuevoAlumnoGrupo, setNuevoAlumnoGrupo] = useState('B2');

  const [mesCuadrante, setMesCuadrante] = useState(new Date().getMonth() + 1); 
  const [anioCuadrante, setAnioCuadrante] = useState(new Date().getFullYear());
  
  const obtenerDiaSemanaClave = (fechaStr) => {
    const partes = fechaStr.split('-');
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    const numeroDia = fecha.getDay(); 
    
    if (numeroDia === 1 || numeroDia === 3) return "L-X"; 
    if (numeroDia === 2 || numeroDia === 4) return "M-J"; 
    if (numeroDia === 5) return "V"; 
    return "L-X"; 
  };

  const [nuevoAlumnoDias, setNuevoAlumnoDias] = useState(() => obtenerDiaSemanaClave(new Date().toISOString().split('T')[0])); 
  const [diaFiltroTabla, setDiaFiltroTabla] = useState(() => obtenerDiaSemanaClave(new Date().toISOString().split('T')[0]));

  const nivelesAcademia = [
    "Primaria", "ESO", "Bachillerato", "PAU", 
    "Mayores 25", "Acceso Grado", "B1", "B2", "C1", "APTIS"
  ];

  const horariosAcademia = [
    "16:15-17:15",
    "17:15-18:15",
    "19:15-20:15",
    "20:15-21:15"
  ];

  const opcionesDias = [
    { clave: "L-X", texto: "Lunes y Miércoles" },
    { clave: "M-J", texto: "Martes y Jueves" },
    { clave: "V", texto: "Viernes" },
    { clave: "L-M-X-J-V", texto: "Lunes a Viernes" }
  ];

  const mesesAnio = [
    { valor: 1, nombre: "Enero" }, { valor: 2, nombre: "Febrero" }, { valor: 3, nombre: "Marzo" },
    { valor: 4, nombre: "Abril" }, { valor: 5, nombre: "Mayo" }, { valor: 6, nombre: "Junio" },
    { valor: 7, nombre: "Julio" }, { valor: 8, nombre: "Agosto" }, { valor: 9, nombre: "Septiembre" },
    { valor: 10, nombre: "Octubre" }, { valor: 11, nombre: "Noviembre" }, { valor: 12, nombre: "Diciembre" }
  ];

  useEffect(() => {
    async function sincronizarConFirebase() {
      if (window.storage) {
        try {
          const datosProfes = await window.storage.get('profesores');
          const datosAlumnos = await window.storage.get('alumnos');
          const datosAsistencias = await window.storage.get('asistencias');

          if (datosProfes && Array.isArray(datosProfes) && datosProfes.length > 0) {
            setProfesores(datosProfes);
            localStorage.setItem('profesores', JSON.stringify(datosProfes));
          }
          if (datosAlumnos && Array.isArray(datosAlumnos) && datosAlumnos.length > 0) {
            setAlumnos(datosAlumnos);
            localStorage.setItem('alumnos', JSON.stringify(datosAlumnos));
          }
          if (datosAsistencias && Object.keys(datosAsistencias).length > 0) {
            setAsistencias(datosAsistencias);
            localStorage.setItem('asistencias', JSON.stringify(datosAsistencias));
          }
        } catch (error) {
          console.error("Firebase offline.", error);
        }
      }
    }
    sincronizarConFirebase();
  }, []);

  useEffect(() => {
    const diaDetectado = obtenerDiaSemanaClave(fechaSeleccionada);
    setNuevoAlumnoDias(diaDetectado);
    setDiaFiltroTabla(diaDetectado);
    
    const partes = fechaSeleccionada.split('-');
    setAnioCuadrante(parseInt(partes[0]));
    setMesCuadrante(parseInt(partes[1]));
  }, [fechaSeleccionada]);

  const guardarDatos = async (clave, nuevosDatos) => {
    localStorage.setItem(clave, JSON.stringify(nuevosDatos));
    if (window.storage) {
      await window.storage.set(clave, nuevosDatos);
    }
  };

  const cambiarNivelAlumno = (id, nuevoNivel) => {
    const listaActualizada = alumnos.map(al => al.id === id ? { ...al, grupo: nuevoNivel } : al);
    setAlumnos(listaActualizada);
    guardarDatos('alumnos', listaActualizada);
  };

  const cambiarHorarioAlumno = (id, nuevoHorario) => {
    const listaActualizada = alumnos.map(al => al.id === id ? { ...al, horario: nuevoHorario } : al);
    setAlumnos(listaActualizada);
    guardarDatos('alumnos', listaActualizada);
  };

  const cambiarDiasAlumno = (id, nuevosDias) => {
    const listaActualizada = alumnos.map(al => al.id === id ? { ...al, dias: nuevosDias } : al);
    setAlumnos(listaActualizada);
    guardarDatos('alumnos', listaActualizada);
  };

  const agregarAlumno = () => {
    if (!nuevoAlumnoNombre.trim() || !profesorActivo) return;
    const nuevo = {
      id: Date.now().toString(),
      nombre: nuevoAlumnoNombre.trim(),
      grupo: nuevoAlumnoGrupo,
      profesor: profesorActivo,
      horario: horaSeleccionada,
      dias: nuevoAlumnoDias 
    };
    const nuevos = [...alumnos, nuevo];
    setAlumnos(nuevos);
    guardarDatos('alumnos', nuevos);
    setDiaFiltroTabla(nuevoAlumnoDias);
    setNuevoAlumnoNombre('');
  };

  const eliminarAlumno = (id) => {
    if (window.confirm("¿Seguro que quieres eliminar a este alumno de la lista?")) {
      const nuevos = alumnos.filter(a => a.id !== id);
      setAlumnos(nuevos);
      guardarDatos('alumnos', nuevos);
    }
  };

  const marcarAsistencia = (alumnoId, estado) => {
    const claveHistorial = `${fechaSeleccionada}_${horaSeleccionada}_${alumnoId}`;
    const nuevas = {
      ...asistencias,
      [claveHistorial]: {
        estado,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    };
    setAsistencias(nuevas);
    guardarDatos('asistencias', nuevas);
  };

  const agregarProfesor = () => {
    if (!nuevoProfeNombre.trim()) return;
    const nuevos = [...profesores, nuevoProfeNombre.trim()];
    setProfesores(nuevos);
    guardarDatos('profesores', nuevos);
    if (!profesorActivo) setProfesorActivo(nuevoProfeNombre.trim());
    setNuevoProfeNombre('');
  };

  const eliminarProfesor = (profe) => {
    const nuevos = profesores.filter(p => p !== profe);
    setProfesores(nuevos);
    guardarDatos('profesores', nuevos);
    if (profesorActivo === profe) setProfesorActivo(nuevos[0] || null);
  };

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
      const nuevosAlumnos = listaJSON.map((item, index) => {
        const nombreDetectado = item.Nombre || item.nombre || item.Alumno || item.alumno || item["Nombre Alumno"] || item["Apellidos y Nombre"];
        const grupoDetectado = item.Grupo || item.grupo || item.Nivel || item.nivel || "B2";
        const horarioDetectado = item.Horario || item.horario || item.Hora || item.hora || horaSeleccionada;
        const diasDetectados = item.Dias || item.dias || item.Días || item.días || obtenerDiaSemanaClave(fechaSeleccionada);
        
        return {
          id: `excel_${Date.now()}_${index}`,
          nombre: nombreDetectado ? nombreDetectado.toString().trim() : "Alumno Anónimo",
          grupo: grupoDetectado.toString().trim(),
          profesor: profesorActivo,
          horario: horarioDetectado.toString().trim(),
          dias: diasDetectados.toString().trim()
        };
      });
      const listaActualizada = [...alumnos, ...nuevosAlumnos];
      setAlumnos(listaActualizada);
      guardarDatos('alumnos', listaActualizada);
    };
    reader.readAsBinaryString(file);
  };

  // --- FUNCIÓN PARA EXPORTAR EL CUADRANTE A EXCEL ---
  const exportarExcelMensual = () => {
    if (!profesorActivo || alumnosDelProfesor.length === 0) {
      alert("No hay alumnos para exportar.");
      return;
    }

    // 1. Preparamos las cabeceras del Excel
    const cabeceras = ["Alumno", "Nivel", "Horario", "Días", ...arregloDias];
    
    // 2. Rellenamos las filas con los datos y las asistencias
    const filas = alumnosDelProfesor.map(alumno => {
      const filaAlumno = [
        alumno.nombre, 
        alumno.grupo, 
        alumno.horario || '', 
        alumno.dias || ''
      ];

      arregloDias.forEach(dia => {
        const mmStr = mesCuadrante < 10 ? `0${mesCuadrante}` : mesCuadrante;
        const ddStr = dia < 10 ? `0${dia}` : dia;
        const fechaCelda = `${anioCuadrante}-${mmStr}-${ddStr}`;
        
        let registroEncontrado = null;
        for (const horaPosible of horariosAcademia) {
          const claveBuscada = `${fechaCelda}_${horaPosible}_${alumno.id}`;
          if (asistencias[claveBuscada]) {
            registroEncontrado = asistencias[claveBuscada];
            break;
          }
        }
        
        if (!registroEncontrado && alumno.horario) {
          const claveEspecial = `${fechaCelda}_${alumno.horario}_${alumno.id}`;
          if (asistencias[claveEspecial]) {
            registroEncontrado = asistencias[claveEspecial];
          }
        }

        let estadoStr = "-";
        if (registroEncontrado?.estado === 'PRESENTE') estadoStr = "PRESENTE";
        if (registroEncontrado?.estado === 'AUSENTE') estadoStr = "AUSENTE";

        filaAlumno.push(estadoStr);
      });

      return filaAlumno;
    });

    // 3. Generamos y descargamos el archivo usando SheetJS
    const datosExcel = [cabeceras, ...filas];
    const hoja = XLSX.utils.aoa_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Asistencia Mensual");

    const nombreMes = mesesAnio.find(m => m.valor === mesCuadrante).nombre;
    const nombreArchivo = `Asistencia_${profesorActivo}_${nombreMes}_${anioCuadrante}.xlsx`;
    
    XLSX.writeFile(libro, nombreArchivo);
  };

  const totalDiasMes = new Date(anioCuadrante, mesCuadrante, 0).getDate();
  const arregloDias = Array.from({ length: totalDiasMes }, (_, i) => i + 1);

  const alumnosFiltrados = alumnos.filter(a => {
    if (a.profesor !== profesorActivo) return false;
    if (!a.horario || !a.dias) return true;
    const coincideHora = a.horario === horaSeleccionada;
    const coincideDia = a.dias === diaFiltroTabla || a.dias === 'L-M-X-J-V';
    return coincideHora && coincideDia;
  });

  const alumnosDelProfesor = alumnos.filter(a => a.profesor === profesorActivo);
  
  const tarjetaEstilo = { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' };
  const inputEstilo = { backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '10px', borderRadius: '8px', outline: 'none' };
  const botonNaranja = { backgroundColor: '#ff6b35', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
  const botonVerde = { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ ...tarjetaEstilo, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 5px 0' }}>ACADEMIA PIRINEOS</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Control de Asistencia Profesional Avanzado</p>
        </div>
        <div>
          <button onClick={() => setVistaAdmin(!vistaAdmin)} style={{ ...botonNaranja, backgroundColor: vistaAdmin ? '#475569' : '#ff6b35' }}>
            {vistaAdmin ? '📊 Pasar Asistencia' : '⚙️ Gestionar Profes y Excel'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        <div style={tarjetaEstilo}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Profesores Activos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profesores.map(p => (
              <div 
                key={p} 
                onClick={() => setProfesorActivo(p)}
                style={{ padding: '12px 15px', backgroundColor: p === profesorActivo ? '#ff6b35' : '#0f172a', color: p === profesorActivo ? 'white' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}
              >
                <span>{p}</span>
                {vistaAdmin && <span onClick={(e) => { e.stopPropagation(); eliminarProfesor(p); }} style={{ color: '#ef4444', cursor: 'pointer' }}>✕</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {vistaAdmin ? (
            <div style={tarjetaEstilo}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Añadir Nuevo Profesor</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                <input type="text" placeholder="Nombre..." value={nuevoProfeNombre} onChange={(e) => setNuevoProfeNombre(e.target.value)} style={{ ...inputEstilo, flex: 1 }} />
                <button onClick={agregarProfesor} style={botonNaranja}>+ Añadir</button>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', borderTop: '1px solid #334155', paddingTop: '20px' }}>Importar Alumnos</h3>
              <input type="file" accept=".xlsx" onChange={importarExcel} disabled={!profesorActivo} style={{ color: '#94a3b8', fontSize: '14px' }} />
            </div>
          ) : (
            <>
              <div style={tarjetaEstilo}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold' }} />
                    <select value={horaSeleccionada} onChange={(e) => setHoraSeleccionada(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold', borderColor: '#ff6b35' }}>
                      {horariosAcademia.map(h => <option key={h} value={h}>🕒 {h}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="text" placeholder="Nuevo alumno..." value={nuevoAlumnoNombre} onChange={(e) => setNuevoAlumnoNombre(e.target.value)} style={inputEstilo} />
                    
                    <select value={nuevoAlumnoGrupo} onChange={(e) => setNuevoAlumnoGrupo(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold' }}>
                      {nivelesAcademia.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                    </select>

                    <select value={nuevoAlumnoDias} onChange={(e) => setNuevoAlumnoDias(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold', borderColor: '#10b981' }}>
                      {opcionesDias.map(opt => <option key={opt.clave} value={opt.clave}>{opt.texto}</option>)}
                    </select>

                    <button onClick={agregarAlumno} style={botonNaranja}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px 15px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>👁️ Pasar lista de:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {opcionesDias.map(opt => (
                      <button key={opt.clave} onClick={() => setDiaFiltroTabla(opt.clave)} style={{ backgroundColor: diaFiltroTabla === opt.clave ? '#10b981' : '#1e293b', color: 'white', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{opt.clave}</button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '13px' }}>
                        <th style={{ padding: '12px' }}>Alumno</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Nivel</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Horario</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Días</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Borrar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosFiltrados.map(a => {
                        const historial = asistencias[`${fechaSeleccionada}_${horaSeleccionada}_${a.id}`];
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #334155' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>
                              {a.nombre}
                              {(!a.horario || !a.dias) && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#ef4444' }}>(Incompleto)</span>}
                            </td>
                            
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select value={a.grupo} onChange={(e) => cambiarNivelAlumno(a.id, e.target.value)} style={{ backgroundColor: '#0f172a', color: '#ff6b35', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ff6b35', fontSize: '12px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {nivelesAcademia.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select value={a.horario || ''} onChange={(e) => cambiarHorarioAlumno(a.id, e.target.value)} style={{ backgroundColor: '#0f172a', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', border: '1px solid #38bdf8', fontSize: '12px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {!a.horario && <option value="" disabled>Sin hora</option>}
                                {horariosAcademia.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select value={a.dias || ''} onChange={(e) => cambiarDiasAlumno(a.id, e.target.value)} style={{ backgroundColor: '#0f172a', color: '#10b981', padding: '6px 10px', borderRadius: '6px', border: '1px solid #10b981', fontSize: '12px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {!a.dias && <option value="" disabled>Sin días</option>}
                                {opcionesDias.map(o => <option key={o.clave} value={o.clave}>{o.clave}</option>)}
                              </select>
                            </td>

                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button onClick={() => marcarAsistencia(a.id, 'PRESENTE')} style={{ backgroundColor: historial?.estado === 'PRESENTE' ? '#16a34a' : '#0f172a', color: historial?.estado === 'PRESENTE' ? 'white' : '#4ade80', border: '1px solid #16a34a', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✓ PRESENTE</button>
                                <button onClick={() => marcarAsistencia(a.id, 'AUSENTE')} style={{ backgroundColor: historial?.estado === 'AUSENTE' ? '#dc2626' : '#0f172a', color: historial?.estado === 'AUSENTE' ? 'white' : '#f87171', border: '1px solid #dc2626', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✕ AUSENTE</button>
                              </div>
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                              {historial ? (
                                <span style={{ fontWeight: 'bold', color: historial.estado === 'PRESENTE' ? '#4ade80' : '#f87171' }}>{historial.estado}</span>
                              ) : <span style={{ color: '#475569', fontStyle: 'italic' }}>-</span>}
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button onClick={() => eliminarAlumno(a.id)} style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }} title="Eliminar alumno">
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {alumnosFiltrados.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '20px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                            No hay alumnos asignados a este horario o día de asistencia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CUADRANTE MENSUAL CON EXPORTACIÓN */}
              <div style={tarjetaEstilo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '15px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>📅 Cuadrante de Asistencia Mensual</h2>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>Muestra las asistencias generales sin importar la hora seleccionada arriba</p>
                  </div>
                  
                  {/* SECCIÓN DERECHA: SELECTORES + BOTÓN DESCARGA EXCEL */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={exportarExcelMensual} style={botonVerde} title="Descargar este mes en Excel">
                      ⬇️ Descargar Excel
                    </button>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={mesCuadrante} onChange={(e) => setMesCuadrante(parseInt(e.target.value))} style={inputEstilo}>
                        {mesesAnio.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
                      </select>
                      <select value={anioCuadrante} onChange={(e) => setAnioCuadrante(parseInt(e.target.value))} style={inputEstilo}>
                        {[2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                        <th style={{ padding: '10px', textAlign: 'left', minWidth: '160px', border: '1px solid #334155' }}>Alumno</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #334155' }}>Clase</th>
                        {arregloDias.map(dia => (
                          <th key={dia} style={{ padding: '5px 2px', textAlign: 'center', minWidth: '24px', border: '1px solid #334155', backgroundColor: '#1e293b' }}>
                            {dia}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosDelProfesor.map(alumno => (
                        <tr key={alumno.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #334155' }}>{alumno.nombre}</td>
                          <td style={{ padding: '8px 4px', color: '#ff6b35', fontSize: '10px', textAlign: 'center', border: '1px solid #334155' }}>
                            {alumno.dias} <br/> <span style={{ color: '#38bdf8' }}>{alumno.horario ? alumno.horario.split('-')[0] : ''}</span>
                          </td>
                          {arregloDias.map(dia => {
                            const mmStr = mesCuadrante < 10 ? `0${mesCuadrante}` : mesCuadrante;
                            const ddStr = dia < 10 ? `0${dia}` : dia;
                            const fechaCelda = `${anioCuadrante}-${mmStr}-${ddStr}`;
                            
                            let registroEncontrado = null;
                            for (const horaPosible of horariosAcademia) {
                              const claveBuscada = `${fechaCelda}_${horaPosible}_${alumno.id}`;
                              if (asistencias[claveBuscada]) {
                                registroEncontrado = asistencias[claveBuscada];
                                break;
                              }
                            }
                            
                            if (!registroEncontrado && alumno.horario) {
                              const claveEspecial = `${fechaCelda}_${alumno.horario}_${alumno.id}`;
                              if (asistencias[claveEspecial]) {
                                registroEncontrado = asistencias[claveEspecial];
                              }
                            }

                            let renderEstado = "-";
                            if (registroEncontrado?.estado === 'PRESENTE') renderEstado = "🟢";
                            if (registroEncontrado?.estado === 'AUSENTE') renderEstado = "🔴";

                            return (
                              <td key={dia} style={{ textAlign: 'center', padding: '4px 0', border: '1px solid #334155', fontSize: '11px' }}>
                                {renderEstado}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', fontSize: '12px', color: '#94a3b8' }}>
                  <span>🟢 = Presente</span>
                  <span>🔴 = Ausente</span>
                  <span>- = Sin registro</span>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
