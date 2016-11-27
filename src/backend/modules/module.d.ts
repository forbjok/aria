
interface IDataStore {
}

interface IServer {
}

interface IModule {
  server: IServer;
  store: IDataStore;
}
