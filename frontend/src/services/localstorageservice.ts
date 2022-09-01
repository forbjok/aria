export class LocalStorageService {
  _getKeyName(name: string): string {
    return `aria_${name}`;
  }

  get(name: string): any {
    const json = window.localStorage.getItem(this._getKeyName(name));
    if (!json) return null;

    return JSON.parse(json);
  }

  set(name: string, value: any) {
    window.localStorage.setItem(this._getKeyName(name), JSON.stringify(value));
  }
}
