export class LocalStorageService
{
  _getKeyName(name: string): string {
    return `aria_${name}`;
  }

  get(name: string): any {
    return JSON.parse(window.localStorage.getItem(this._getKeyName(name)));
  }

  set(name: string, value: any) {
    window.localStorage.setItem(this._getKeyName(name), JSON.stringify(value));
  }
}
