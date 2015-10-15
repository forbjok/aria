import $ from "jquery";

$(document).ready(() => {
  var postContainer = $("#postContainer");
  var chatControls = $("#chatControls");

  console.log("RD", postContainer, chatControls);

  function initChatWidth() {
    var chatControlsWidth = chatControls.width() + 4;

    postContainer.css("width", chatControlsWidth);
    $("#contentContainer").css("left", chatControlsWidth);
  }

  function setPostContainerSize() {
    var chatControlsHeight = chatControls.height();

    postContainer.css("bottom", chatControlsHeight);
    console.log("BARF", chatControlsHeight);
  }

  initChatWidth();
  setPostContainerSize();

  $(window).resize(() => { setPostContainerSize(); });
});
