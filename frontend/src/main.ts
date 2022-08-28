import { Aurelia } from "aurelia-framework";
import environment from "../config/environment.json";
import { PLATFORM } from "aurelia-framework";
import { State } from "state";

export function configure(aurelia: Aurelia): void {
  aurelia.use.standardConfiguration().feature(PLATFORM.moduleName("resources/index"));

  aurelia.use.developmentLogging(environment.debug ? "debug" : "warn");

  if (environment.testing) {
    aurelia.use.plugin(PLATFORM.moduleName("aurelia-testing"));
  }

  aurelia.use.singleton(State, () => new State());

  aurelia.start().then(() => aurelia.setRoot(PLATFORM.moduleName("app")));
}
