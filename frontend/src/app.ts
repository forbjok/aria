import { Router, RouterConfiguration } from "aurelia-router";
import {PLATFORM} from 'aurelia-framework';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';

export class App {
  router: Router;

  configureRouter(config: RouterConfiguration, router: Router): void {
    this.router = router;
    config.title = 'Aria';

    config.options.pushState = true;
    config.options.root = '/';

    config.map([
      { route: '', name: 'home', moduleId: PLATFORM.moduleName('views/home') },
      { route: 'r/:roomName', name: 'room', moduleId: PLATFORM.moduleName('room') },
      { route: 'r/:roomName/claim', name: 'claim', moduleId: PLATFORM.moduleName('claim') },
    ]);
  }
}
