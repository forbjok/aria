import $ from "jquery";

export class App {
  configureRouter(config, router) {
    config.title = 'Aria';
    config.map([
      { route: ['', 'content'], name: 'content', moduleId: 'content', nav: true, title: 'Content' },
    ]);

    this.router = router;
  }
}
