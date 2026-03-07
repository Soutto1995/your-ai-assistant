import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PlansPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/pricing", { replace: true });
  }, [navigate]);

  return null;
}