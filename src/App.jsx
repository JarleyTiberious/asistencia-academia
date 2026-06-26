import React, { useState, useEffect } from 'react';

export default function App() {
  const [profesores, setProfesores] = useState(['Aurora', 'Alberto', 'Lucía']); // Datos de prueba para validar diseño
  const [profesorActivo, setProfesorActivo] = useState('Aurora');
  const [alumnos, setAlumnos] = useState([{ id: 1, nombre: 'Ainhoa Andía', grupo: 'B1' }]);

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0' }}>ACADEMIA PIRINEOS</h1>
        <p style={{ color: '#94a3b8', margin: 0 }}>Control de asistencia — {new Date().toLocaleDateString()}</p>
      </div>

      {/* Contenido */}
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
        {/* Sidebar Profesores */}
        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>Profesores</h2>
          {profesores.map(p => (
            <div key={p} style={{ padding: '10px', backgroundColor: p === profesorActivo ? '#ff6b35' : '#0f172a', borderRadius: '8px', marginBottom: '5px', cursor: 'pointer' }}>
              {p}
            </div>
          ))}
        </div>

        {/* Tabla Alumnos */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '10px' }}>Alumno</th>
                <th style={{ padding: '10px' }}>Nivel</th>
                <th style={{ padding: '10px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '10px' }}>{a.nombre}</td>
                  <td style={{ padding: '10px' }}>{a.grupo}</td>
                  <td style={{ padding: '10px' }}>
                    <button style={{ backgroundColor: '#ff6b35', border: 'none', padding: '5px 10px', borderRadius: '4px', color: 'white' }}>Presente</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
