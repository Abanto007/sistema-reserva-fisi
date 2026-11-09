import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SesionProvider } from "./hooks/useSesion";
import App from "./App";
import FaltaConfiguracion from "./pages/FaltaConfiguracion";
import "./assets/styles/global.css";

const url = import.meta.env.VITE_CONVEX_URL;
const raiz = ReactDOM.createRoot(document.getElementById("root"));

if (!url) {
  raiz.render(<FaltaConfiguracion />);
} else {
  const convex = new ConvexReactClient(url);
  raiz.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <SesionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SesionProvider>
      </ConvexProvider>
    </React.StrictMode>,
  );
}
