/**
 * What the client talks to: the game room (a transport) and the REST API. Production uses the
 * WebSocket and fetch; the floor lab swaps in an in-browser room and a local account.
 */
import type { Entity } from "@inferno/shared";
import { createContext, useContext, type ReactNode } from "react";
import { api as httpApi } from "./net/api.js";
import { webSocketTransport, type TransportFactory } from "./net/socket.js";

export type Api = typeof httpApi;

export interface Services {
  transport: TransportFactory;
  api: Api;
  googleClientId: string;
  /** Floor lab only: hidden entities to outline on the map. */
  xray?: () => Entity[];
  /** Extra UI rendered by the floor lab (its dev drawer); absent in the game. */
  devtools?: ReactNode;
}

export const productionServices: Services = {
  transport: webSocketTransport,
  api: httpApi,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
};

const ServicesContext = createContext<Services>(productionServices);

export const ServicesProvider = ServicesContext.Provider;

export function useServices(): Services {
  return useContext(ServicesContext);
}
