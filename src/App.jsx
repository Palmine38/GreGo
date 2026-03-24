import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import FastResearch from './components/fast-research.jsx'
import MesTrajets from './components/mestrajets.jsx'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/fastresearch" element={<FastResearch />} />
        <Route path="/mes-trajets" element={<MesTrajets />} />
        <Route path="/" element={<Navigate to="/mes-trajets" replace />} />
      </Routes>
    </Router>
  )
}

export default App
