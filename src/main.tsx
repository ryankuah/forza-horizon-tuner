import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

document.documentElement.classList.add("dark");

const rootElement = document.getElementById("root") as HTMLElement;
const rootWindow = window as Window & {
  __forzaTunerRoot?: ReturnType<typeof createRoot>;
};

rootWindow.__forzaTunerRoot ??= createRoot(rootElement);
rootWindow.__forzaTunerRoot.render(<App />);
