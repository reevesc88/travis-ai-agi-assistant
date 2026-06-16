import { render } from "preact";
import { App } from "./app";
import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/schedule.css";
import "./styles/animations.css";
import "./styles/responsive.css";
import "./styles/landing.css";

render(<App />, document.getElementById("app")!);
