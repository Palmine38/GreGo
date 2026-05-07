import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import FastResearch from "./fast-research.jsx";
import MesTrajets from "./mes-trajets.jsx";
import NoMobile from "./nomobile.jsx";
import "./App.css";

function DeviceGuard({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768;
    if (!isMobile) {
      navigate("/mobile?false", { replace: true });
    }
  }, []);

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/mobile" element={<NoMobile />} />
        <Route
          path="/fastresearch"
          element={
            <DeviceGuard>
              <FastResearch />
            </DeviceGuard>
          }
        />
        <Route
          path="/mes-trajets"
          element={
            <DeviceGuard>
              <MesTrajets />
            </DeviceGuard>
          }
        />
        <Route path="/" element={<Navigate to="/mes-trajets" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
