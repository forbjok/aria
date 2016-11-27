let mozDocument: any = document;
let msDocument: any = document;

let fullscreenEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || mozDocument.mozFullScreenEnabled || msDocument.msFullscreenEnabled;
let exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || mozDocument.mozCancelFullScreen || msDocument.msExitFullscreen;

function requestFullscreen(e) {
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
  return (document.fullscreenElement || document.webkitFullscreenElement || msDocument.mozFullScreenElement || msDocument.msFullscreenElement) ? true : false;
}

export default {
  fullscreenEnabled: () => fullscreenEnabled.call(document),
  exitFullscreen: () => exitFullscreen.call(document),
  requestFullscreen: requestFullscreen,
  isInFullscreen: isInFullscreen
};
