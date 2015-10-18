export class Content {
  get contentUrl() {
    switch (this.id) {
      case 1:
        return "STEIN";
      case 2:
        return "BALLE";
      default:
        return "http://www.ustream.tv/embed/16698010?html5ui";
    }
  }

  attached() {
    var chatFrame = $("#chatFrame");
    var contentContainer = $("#contentContainer");

    function resize() {
      var chatFrameWidth = chatFrame.width();

      contentContainer.css("left", chatFrameWidth);
    }

    resize();

    $(window).resize(() => {
      resize();
    });
  }
}
