import { patientHandlers } from "./patients";
import { commandHandlers } from "./commands";
import { reportHandlers } from "./reports";
import { dispatchHandlers } from "./dispatch";
import { audioHandlers } from "./audio";

export const handlers = [
  ...patientHandlers,
  ...commandHandlers,
  ...reportHandlers,
  ...dispatchHandlers,
  ...audioHandlers,
];
