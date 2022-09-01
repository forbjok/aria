const mozDocument: any = document;
const msDocument: any = document;
const webkitDocument: any = document;

const fullscreenEnabled =
  document.fullscreenEnabled ||
  webkitDocument.webkitFullscreenEnabled ||
  mozDocument.mozFullScreenEnabled ||
  msDocument.msFullscreenEnabled;
const exitFullscreen =
  document.exitFullscreen ||
  webkitDocument.webkitExitFullscreen ||
  mozDocument.mozCancelFullScreen ||
  msDocument.msExitFullscreen;

function requestFullscreen(e: any) {
  if (e.requestFullscreen) {
    e.requestFullscreen();
  } else if (e.webkitRequestFullscreen) {
    e.webkitRequestFullscreen();
  } else if (e.mozRequestFullScreen) {
    e.mozRequestFullScreen();
  } else if (e.msRequestFullscreen) {
    e.msRequestFullscreen();
  }
}

function isInFullscreen() {
  return document.fullscreenElement ||
    webkitDocument.webkitFullscreenElement ||
    msDocument.mozFullScreenElement ||
    msDocument.msFullscreenElement
    ? true
    : false;
}

export default {
  fullscreenEnabled: () => fullscreenEnabled.call(document),
  exitFullscreen: () => exitFullscreen.call(document),
  requestFullscreen: requestFullscreen,
  isInFullscreen: isInFullscreen,
};
