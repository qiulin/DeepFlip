
import React, { createContext, useContext, useMemo } from 'react';
import environmentConfig, { type EnvConfigType } from '@/services/environment';

const EnvContext = createContext<EnvConfigType>(environmentConfig);

export const EnvProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useMemo(() => environmentConfig, []);
  return <EnvContext.Provider value={config}>{children}</EnvContext.Provider>;
};

export const useEnvContext = (): EnvConfigType => useContext(EnvContext);
