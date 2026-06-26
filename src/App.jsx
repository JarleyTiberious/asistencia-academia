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
  const [nuevoAlumnoDias, setNuevoAlumnoDias] = useState('L-X'); 
  const [escuchandoVoces, setEscuchandoVoces] = useState(false);
  const [mensajeVozInfo, setMensajeVozInfo] = useState('');

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

  const mapeoHorasVoz = [
    { claves: ["16", "cuatro", "16:15"], valor: "16:15-17:15" },
    { claves: ["17", "cinco", "17:15"], valor: "17:15-18:15" },
    { claves: ["19", "siete", "19:15"], valor: "19:15-20:15" },
    { claves: ["20", "ocho", "20:15"], valor: "20:15-21:15" }
  ];

  useEffect(() => {
    async function sincronizarConFirebase() {
      if (window.storage) {
        const datosProfes = await window.storage.get('profesores');
        const datosAlumnos = await window.storage.get('alumnos');
        const datosAsistencias = await window.storage.get('asistencias');

        if (datosProfes && datosProfes.length > 0) {
          setProfesores(datosProfes);
          localStorage.setItem('profesores', JSON.stringify(datosProfes));
          if (!profesorActivo) setProfesorActivo(datosProfes[0]);
        }
        if (datosAlumnos && datosAlumnos.length > 0) {
          setAlumnos(datosAlumnos);
          localStorage.setItem('alumnos', JSON.stringify(datosAlumnos));
        }
        if (datosAsistencias) {
          setAsistencias(datosAsistencias);
          localStorage.setItem('asistencias', JSON.stringify(datosAsistencias));
        }
      }
    }
    sincronizarConFirebase();
  }, []);

  const guardarDatos = async (clave, nuevosDatos) => {
    localStorage.setItem(clave, JSON.stringify(nuevosDatos));
    if (window.storage) {
      await window.storage.set(clave, nuevosDatos);
    }
  };

  const obtenerDiaSemanaClave = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const numeroDia = fecha.getDay(); 
    
    if (numeroDia === 1 || numeroDia === 3) return "L-X"; 
    if (numeroDia === 2 || numeroDia === 4) return "M-J"; 
    if (numeroDia === 5) return "V"; 
    return "L-X"; 
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

  // --- PROCESADOR INTELIGENTE DE AUDIO ---
  const procesarComandoVoz = (frase) => {
    const texto = frase.toLowerCase().trim();
    setMensajeVozInfo(`Entendido: "${frase}"`);

    let profeEncontrado = profesorActivo;
    for (const profe of profesores) {
      if (texto.includes(profe.toLowerCase())) {
        setProfesorActivo(profe);
        profeEncontrado = profe;
        break;
      }
    }

    let horaEncontrada = horaSeleccionada;
    for (const mapeo of mapeoHorasVoz) {
      if (mapeo.claves.some(clave => texto.includes(clave))) {
        setHoraSeleccionada(mapeo.value);
        horaEncontrada = mapeo.value;
        break;
      }
    }

    const diaActualFiltro = obtenerDiaSemanaClave(fechaSeleccionada);
    const listaAlumnosFiltrados = alumnos.filter(a => 
      a.profesor === profeEncontrado && 
      a.horario === horaEncontrada &&
      (a.dias === diaActualFiltro || a.dias === 'L-M-X-J-V')
    );

    let alumnoEncontrado = null;
    for (const alumno of listaAlumnosFiltrados) {
      if (texto.includes(alumno.nombre.toLowerCase())) {
        alumnoEncontrado = alumno;
        break;
      }
    }

    if (alumnoEncontrado) {
      let estadoVoz = null;
      if (texto.includes("presente") || texto.includes("vino") || texto.includes("asiste") || texto.includes("está")) {
        estadoVoz = "PRESENTE";
      } else if (texto.includes("ausente") || texto.includes("falta") || texto.includes("no vino") || texto.includes("no está")) {
        estadoVoz = "AUSENTE";
      }

      if (estadoVoz) {
        const claveHistorial = `${fechaSeleccionada}_${horaEncontrada}_${alumnoEncontrado.id}`;
        const nuevas = {
          ...asistencias,
          [claveHistorial]: {
            estado: estadoVoz,
            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        };
        setAsistencias(nuevas);
        guardarDatos('asistencias', nuevas);
        setMensajeVozInfo(`✅ ${alumnoEncontrado.nombre} marcado como ${estadoVoz} (${horaEncontrada})`);
        return;
      }
    }

    const limpio = frase.replace(/\.$/, '');
    setNuevoAlumnoNombre(limpio);
  };

  const activarDictadoVoz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Navegador no compatible con dictado de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setEscuchandoVoces(true); setMensajeVozInfo('Escuchando orden de voz...'); };
    recognition.onerror = () => { setEscuchandoVoces(false); };
    recognition.onend = () => { setEscuchandoVoces(false); };
    recognition.onresult = (event) => { procesarComandoVoz(event.results[0][0].transcript); };
    recognition.start();
  };

  // --- ACCIONES GESTIÓN ---
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
    setNuevoAlumnoNombre('');
  };

  const eliminarAlumno = (id) => {
    const nuevos = alumnos.filter(a => a.id !== id);
    setAlumnos(nuevos);
    guardarDatos('alumnos', nuevos);
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

  // --- FILTRADO TRIPLE AVANZADO ---
  const diaFiltroActivo = obtenerDiaSemanaClave(fechaSeleccionada);
  const alumnosFiltrados = alumnos.filter(a => 
    a.profesor === profesorActivo && 
    a.horario === horaSeleccionada &&
    (a.dias === diaFiltroActivo || a.dias === 'L-M-X-J-V')
  );
  
  const tarjetaEstilo = { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' };
  const inputEstilo = { backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '10px', borderRadius: '8px', outline: 'none' };
  const botonNaranja = { backgroundColor: '#ff6b35', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
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

      {mensajeVozInfo && (
        <div style={{ backgroundColor: '#1e293b', color: '#ff6b35', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ff6b35', fontSize: '14px', fontWeight: 'bold' }}>
          {mensajeVozInfo}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        {/* SIDEBAR */}
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

        {/* CONTENIDO PRINCIPAL */}
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
            <div style={tarjetaEstilo}>
              {/* FILTROS Y ALTA */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold' }} />
                  <select value={horaSeleccionada} onChange={(e) => setHoraSeleccionada(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold', borderColor: '#ff6b35' }}>
                    {horariosAcademia.map(h => <option key={h} value={h}>🕒 {h}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={activarDictadoVoz} style={{ backgroundColor: escuchandoVoces ? '#ef4444' : '#1e293b', color: 'white', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
                    {escuchandoVoces ? '🛑...' : '🎙️'}
                  </button>
                  <input type="text" placeholder={escuchandoVoces ? "Hable ahora..." : "Nuevo alumno..."} value={nuevoAlumnoNombre} onChange={(e) => setNuevoAlumnoNombre(e.target.value)} style={inputEstilo} />
                  
                  <select value={nuevoAlumnoGrupo} onChange={(e) => setNuevoAlumnoGrupo(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold' }}>
                    {nivelesAcademia.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                  </select>

                  {/* SELECTOR DE DÍAS CORREGIDO (Sin emojis en el value) */}
                  <select value={nuevoAlumnoDias} onChange={(e) => setNuevoAlumnoDias(e.target.value)} style={{ ...inputEstilo, fontWeight: 'bold', borderColor: '#10b981' }}>
                    {opcionesDias.map(opt => <option key={opt.clave} value={opt.clave}>{opt.texto}</option>)}
                  </select>

                  <button onClick={agregarAlumno} style={botonNaranja}>+</button>
                </div>
              </div>

              {/* TABLA DE ASISTENCIA */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '13px' }}>
                      <th style={{ padding: '12px' }}>Alumno</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Nivel</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Horario</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Días (Editable)</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnosFiltrados.map(a => {
                      const historial = asistencias[`${fechaSeleccionada}_${horaSeleccionada}_${a.id}`];
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{a.nombre}</td>
                          
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <select
                              value={a.grupo}
                              onChange={(e) => cambiarNivelAlumno(a.id, e.target.value)}
                              style={{ backgroundColor: '#0f172a', color: '#ff6b35', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ff6b35', outline: 'none', cursor: 'pointer' }}
                            >
                              {nivelesAcademia.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                            </select>
                          </td>

                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <select
                              value={a.horario}
                              onChange={(e) => cambiarHorarioAlumno(a.id, e.target.value)}
                              style={{ backgroundColor: '#0f172a', color: '#38bdf8', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #38bdf8', outline: 'none', cursor: 'pointer' }}
                            >
                              {horariosAcademia.map(h => <option key={h} value={h}>🕒 {h}</option>)}
                            </select>
                          </td>

                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <select
                              value={a.dias || 'L-X'}
                              onChange={(e) => cambiarDiasAlumno(a.id, e.target.value)}
                              style={{ backgroundColor: '#0f172a', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #10b981', outline: 'none', cursor: 'pointer' }}
                            >
                              {opcionesDias.map(opt => <option key={opt.clave} value={opt.clave}>{opt.clave}</option>)}
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
                              <div>
                                <span style={{ fontWeight: 'bold', color: historial.estado === 'PRESENTE' ? '#4ade80' : '#f87171' }}>{historial.estado}</span>
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>⏱ {historial.hora}</div>
                              </div>
                            ) : <span style={{ color: '#475569', fontStyle: 'italic' }}>Sin registro</span>}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span onClick={() => eliminarAlumno(a.id)} style={{ color: '#475569', cursor: 'pointer' }}>🗑</span>
                          </td>
                        </tr>
                      );
                    })}
                    {alumnosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ padding: '30px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
                          No hay alumnos asignados para este profesor, horario y días lectivos correspondientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
