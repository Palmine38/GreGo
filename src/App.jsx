import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import FastResearch from './components/fast-research.jsx'
import MesTrajets from './components/mestrajets.jsx'
import MestrajetsTest from './components/mestrajets-test.jsx'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/fastresearch" element={<FastResearch />} />
        <Route path="/mes-trajets" element={<MestrajetsTest />} />
        <Route path="/" element={<Navigate to="/mes-trajets" replace />} />
        <Route path="/test" element={<MesTrajets />} />
      </Routes>
    </Router>
  )
}

export default App
