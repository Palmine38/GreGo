import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import FastResearch from './components/fast-research.jsx'
import MesTrajets from './components/mestrajets.jsx'
import MestrajetsTest from './components/mestrajets-test.jsx'
import NoMobile from './components/nomobile.jsx'
import './App.css'

function DeviceGuard({ children }) {
  const navigate = useNavigate()

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
    if (!isMobile) {
      navigate('/mobile?false', { replace: true })
    }
  }, [])

  return children
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/mobile" element={<NoMobile />} />
        <Route path="/fastresearch" element={<DeviceGuard><FastResearch /></DeviceGuard>} />
        <Route path="/mes-trajets" element={<DeviceGuard><MestrajetsTest /></DeviceGuard>} />
        <Route path="/" element={<Navigate to="/mes-trajets" replace />} />
        <Route path="/test" element={<DeviceGuard><MesTrajets /></DeviceGuard>} />
      </Routes>
    </Router>
  )
}

export default App