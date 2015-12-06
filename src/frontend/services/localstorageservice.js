export class LocalStorageService
{
  _getKeyName(name) {
    return `aria_${name}`;
  }

  get(name) {
    return JSON.parse(window.localStorage.getItem(this._getKeyName(name)));
  }

  set(name, value) {
    window.localStorage.setItem(this._getKeyName(name), JSON.stringify(value));
  }
}
