export class LocalStorageService {
  get<T>(name: string): T | null {
    const json = window.localStorage.getItem(this.getKeyName(name));
    if (!json) return null;

    return JSON.parse(json);
  }

  set<T>(name: string, value: T | null) {
    window.localStorage.setItem(this.getKeyName(name), JSON.stringify(value));
  }

  private getKeyName(name: string): string {
    return `aria_${name}`;
  }
}
