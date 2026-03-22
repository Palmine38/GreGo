import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import TestHome from './components/testhome.jsx'
import MesTrajets from './components/mestrajets.jsx'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/fastresearch" element={<TestHome />} />
        <Route path="/mes-trajets" element={<MesTrajets />} />
        <Route path="/" element={<Navigate to="/fastresearch" replace />} />
      </Routes>
    </Router>
  )
}

export default App
