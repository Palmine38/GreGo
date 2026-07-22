import { useNavigate } from "react-router-dom";

function NoMobile() {
  const navigate = useNavigate();

  const handleContinueAnyway = () => {
    sessionStorage.setItem("bypassDeviceGuard", "true");
    navigate("/", { replace: true });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
      }}
    >
      <img
        src="/nomobile.png"
        alt="Mobile uniquement"
        style={{ maxWidth: "400px", width: "80%" }}
      />
      <p
        onClick={handleContinueAnyway}
        style={{
          marginTop: "24px",
          cursor: "pointer",
          textDecoration: "underline",
          opacity: 0.7,
        }}
      >
        Continuer quand même
      </p>
    </div>
  );
}

export default NoMobile;
