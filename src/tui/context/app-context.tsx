import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  ApiEndpoint,
  ApiSpec,
  Environment,
  HttpRequestConfig,
  HttpResponse,
  RequestHistoryItem,
} from '../../types/index.js';
import { HttpClient } from '../../core/client/http-client.js';
import { OpenApiDiscovery } from '../../core/discovery/openapi-discovery.js';
import { SafeProber } from '../../core/discovery/probing.js';
import { EnvManager } from '../../core/environments/env-manager.js';
import { AuthManager } from '../../core/auth/auth-manager.js';
import { HistoryManager } from '../../core/history/history-manager.js';
import { CollectionManager } from '../../core/collections/collection-manager.js';
import { isDangerousMethod, isProductionUrl } from '../../core/security/safety.js';

export type ScreenType =
  | 'dashboard'
  | 'explorer'
  | 'details'
  | 'builder'
  | 'response'
  | 'history'
  | 'collections'
  | 'environments'
  | 'code-gen'
  | 'command-palette'
  | 'search';

export interface AppContextType {
  screen: ScreenType;
  prevScreen: ScreenType;
  setScreen: (s: ScreenType) => void;
  spec: ApiSpec | null;
  setSpec: (s: ApiSpec | null) => void;
  activeEndpoint: ApiEndpoint | null;
  setActiveEndpoint: (e: ApiEndpoint | null) => void;
  environments: Environment[];
  activeEnv: Environment;
  switchEnvironment: (name: string) => void;
  historyItems: RequestHistoryItem[];
  lastResponse: HttpResponse | null;
  lastRequestConfig: HttpRequestConfig | null;
  statusMessage: string;
  setStatusMessage: (msg: string) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  warningModal: {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
  setWarningModal: (modal: any) => void;
  builderParams: Record<string, string>;
  setBuilderParams: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  builderQuery: Record<string, string>;
  setBuilderQuery: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  builderHeaders: Record<string, string>;
  setBuilderHeaders: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  builderBody: string;
  setBuilderBody: (body: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  connectToUrl: (url: string, explicitSpec?: string) => Promise<boolean>;
  executeRequest: (overrideConfig?: HttpRequestConfig) => Promise<HttpResponse | null>;
  client: HttpClient;
  envManager: EnvManager;
  authManager: AuthManager;
  historyManager: HistoryManager;
  collectionManager: CollectionManager;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{
  initialUrl?: string;
  children: React.ReactNode;
}> = ({ initialUrl, children }) => {
  const [client] = useState(() => new HttpClient());
  const [envManager] = useState(() => new EnvManager());
  const [authManager] = useState(() => new AuthManager());
  const [historyManager] = useState(() => new HistoryManager());
  const [collectionManager] = useState(() => new CollectionManager());
  const [openApiDiscovery] = useState(() => new OpenApiDiscovery(client));
  const [safeProber] = useState(() => new SafeProber(client));

  const [screen, setScreenState] = useState<ScreenType>('dashboard');
  const [prevScreen, setPrevScreen] = useState<ScreenType>('dashboard');
  const [spec, setSpec] = useState<ApiSpec | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<ApiEndpoint | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnv, setActiveEnv] = useState<Environment>({
    name: 'local',
    baseUrl: 'http://localhost:3000',
    variables: {},
    isProduction: false,
  });
  const [historyItems, setHistoryItems] = useState<RequestHistoryItem[]>([]);
  const [lastResponse, setLastResponse] = useState<HttpResponse | null>(null);
  const [lastRequestConfig, setLastRequestConfig] = useState<HttpRequestConfig | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [loading, setLoading] = useState<boolean>(false);
  const [warningModal, setWarningModal] = useState<any>(null);

  // Request builder states
  const [builderParams, setBuilderParams] = useState<Record<string, string>>({});
  const [builderQuery, setBuilderQuery] = useState<Record<string, string>>({});
  const [builderHeaders, setBuilderHeaders] = useState<Record<string, string>>({});
  const [builderBody, setBuilderBody] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const setScreen = (nextScreen: ScreenType) => {
    setPrevScreen(screen);
    setScreenState(nextScreen);
  };

  useEffect(() => {
    async function initManagers() {
      await envManager.init();
      await authManager.init();
      await historyManager.init();
      await collectionManager.init();

      setEnvironments(envManager.getEnvironments());
      setActiveEnv(envManager.getActiveEnvironment());
      setHistoryItems(historyManager.getItems(50));

      if (initialUrl) {
        await connectToUrl(initialUrl);
      }
    }
    initManagers().catch(console.error);
  }, []);

  const switchEnvironment = (name: string) => {
    try {
      const env = envManager.setActiveEnvironment(name);
      setActiveEnv(env);
      envManager.save().catch(console.error);
      setStatusMessage(`Switched environment to [${env.name}]`);
    } catch (e: any) {
      setStatusMessage(`Failed to switch environment: ${e.message}`);
    }
  };

  const connectToUrl = async (targetUrl: string, explicitSpec?: string): Promise<boolean> => {
    setLoading(true);
    setStatusMessage(`Connecting to ${targetUrl}...`);

    try {
      // 1. Check OpenAPI discovery
      const openApiResult = await openApiDiscovery.discover(targetUrl, explicitSpec);
      if (openApiResult) {
        setSpec(openApiResult.spec);
        setStatusMessage(`Connected! Detected OpenAPI (${openApiResult.spec.endpoints.length} endpoints)`);
        setScreenState('explorer');
        setLoading(false);
        return true;
      }

      // 2. Safe probing fallback
      const probeResult = await safeProber.probe(targetUrl);
      if (probeResult.isReachable) {
        const inferredSpec = safeProber.createInferredSpec(probeResult);
        setSpec(inferredSpec);
        setStatusMessage(`Connected! Discovered ${inferredSpec.endpoints.length} endpoints via probing.`);
        setScreenState('explorer');
        setLoading(false);
        return true;
      }

      setStatusMessage(`Unable to connect to ${targetUrl}. Is the server running?`);
      setLoading(false);
      return false;
    } catch (err: any) {
      setStatusMessage(`Connection error: ${err.message}`);
      setLoading(false);
      return false;
    }
  };

  const executeRequest = async (overrideConfig?: HttpRequestConfig): Promise<HttpResponse | null> => {
    if (!activeEndpoint && !overrideConfig) return null;

    const method = overrideConfig?.method || activeEndpoint!.method;
    let urlPath = overrideConfig?.url || activeEndpoint!.path;

    // Substitute path params
    for (const [k, v] of Object.entries(builderParams)) {
      urlPath = urlPath.replace(`{${k}}`, encodeURIComponent(v)).replace(`:${k}`, encodeURIComponent(v));
    }

    const baseUrl = activeEnv.baseUrl || spec?.baseUrl || 'http://localhost';
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl.replace(/\/$/, '')}${urlPath}`;

    let parsedBody: any = undefined;
    if (builderBody.trim()) {
      try {
        parsedBody = JSON.parse(builderBody);
      } catch {
        parsedBody = builderBody;
      }
    }

    const reqConfig: HttpRequestConfig = overrideConfig || {
      url: fullUrl,
      method,
      headers: { ...builderHeaders },
      query: { ...builderQuery },
      body: parsedBody,
    };

    // Apply Auth
    const authedConfig = authManager.applyAuth(reqConfig);

    // Check production safety
    const isProd = activeEnv.isProduction || isProductionUrl(fullUrl);
    if (isDangerousMethod(method) && isProd) {
      return new Promise((resolve) => {
        setWarningModal({
          message: `DANGEROUS OPERATION: You are about to execute ${method} ${fullUrl} in PRODUCTION. Continue?`,
          onConfirm: async () => {
            setWarningModal(null);
            const resp = await performExecute(authedConfig);
            resolve(resp);
          },
          onCancel: () => {
            setWarningModal(null);
            setStatusMessage('Request canceled.');
            resolve(null);
          },
        });
      });
    }

    return performExecute(authedConfig);
  };

  const performExecute = async (config: HttpRequestConfig): Promise<HttpResponse | null> => {
    setLoading(true);
    setStatusMessage(`Sending ${config.method} ${config.url}...`);

    try {
      const response = await client.request(config);
      setLastResponse(response);
      setLastRequestConfig(config);
      setScreenState('response');
      setStatusMessage(`Completed: ${response.status} ${response.statusText} (${response.timing.total}ms)`);

      // Record in history
      await historyManager.record(config, response, activeEnv.name);
      setHistoryItems(historyManager.getItems(50));

      setLoading(false);
      return response;
    } catch (err: any) {
      setStatusMessage(`Request failed: ${err.message}`);
      setLoading(false);
      return null;
    }
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        prevScreen,
        setScreen,
        spec,
        setSpec,
        activeEndpoint,
        setActiveEndpoint,
        environments,
        activeEnv,
        switchEnvironment,
        historyItems,
        lastResponse,
        lastRequestConfig,
        statusMessage,
        setStatusMessage,
        loading,
        setLoading,
        warningModal,
        setWarningModal,
        builderParams,
        setBuilderParams,
        builderQuery,
        setBuilderQuery,
        builderHeaders,
        setBuilderHeaders,
        builderBody,
        setBuilderBody,
        searchQuery,
        setSearchQuery,
        connectToUrl,
        executeRequest,
        client,
        envManager,
        authManager,
        historyManager,
        collectionManager,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
