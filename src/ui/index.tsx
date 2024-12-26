import * as React from "react";
import { createRoot } from "react-dom/client";

import { AppForm } from "./AppForm";
import { AppList } from "./AppList";

const rootElement = document.getElementById("root") as HTMLElement;
const root = createRoot(rootElement);
root.render(rootElement.getAttribute("data-mode") === "form" ? <AppForm /> : <AppList />);

