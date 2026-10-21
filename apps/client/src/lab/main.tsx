/** The floor lab: the real game client, playing against an in-browser room and crowd. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../App.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { ServicesProvider, type Services } from "../services.js";
import "../styles.css";
import { loadFloors, loadSolutions } from "./floors.js";
import { LabDrawer } from "./LabDrawer.js";
import "./lab.css";
import { LAB_USER, LabServer } from "./server.js";

const lab = new LabServer(loadFloors(), loadSolutions());
let me = { id: LAB_USER.userId, handle: LAB_USER.handle };

const services: Services = {
  transport: lab.transport,
  googleClientId: "",
  api: {
    me: () => Promise.resolve(me),
    signIn: () => Promise.reject(new Error("no sign-in in the lab")),
    logout: () => Promise.resolve(),
    setHandle: (handle: string) => {
      me = { ...me, handle };
      return Promise.resolve({ handle });
    },
  },
  xray: () => lab.xray(),
  devtools: <LabDrawer lab={lab} />,
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ServicesProvider value={services}>
        <App />
      </ServicesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
