import React from 'react'
import ConsultaActas from './ConsultaActas'

export default function App() {
  return (
    <div className="container">
      <h1 style={{marginBottom:16}}>Consulta y Notificación de Actas</h1>
      <div className="card">
        <ConsultaActas />
      </div>
    </div>
  )
}
