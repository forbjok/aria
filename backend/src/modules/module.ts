export interface IDataStore {}

export interface IServer {}

export interface IModule {
  server: IServer;
  store: IDataStore;
}
