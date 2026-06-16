import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { queryClient } from "@/lib/queryClient";
import "./index.css";

document.documentElement.classList.add("dark");

const rootElement = document.getElementById("root") as HTMLElement;
const rootWindow = window as Window & {
  __forzaTunerRoot?: ReturnType<typeof createRoot>;
};

rootWindow.__forzaTunerRoot ??= createRoot(rootElement);
rootWindow.__forzaTunerRoot.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
