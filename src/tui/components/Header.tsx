import React from 'react';
import { Box, Text } from 'ink';
import { useApp } from '../context/app-context.js';

export const Header: React.FC = () => {
  const { spec, activeEnv, loading } = useApp();

  const isConnected = Boolean(spec);
  const isProd = activeEnv.isProduction;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="cyan">
            APiX
          </Text>
          <Text color="gray"> │ Universal Terminal API Platform</Text>
        </Box>
        <Box>
          <Text color="gray">v1.0.0</Text>
        </Box>
      </Box>

      <Box justifyContent="space-between" marginTop={1}>
        <Box>
          {isConnected ? (
            <Text color="green">● CONNECTED </Text>
          ) : (
            <Text color="yellow">○ DISCONNECTED </Text>
          )}
          <Text bold color="white">
            {spec ? spec.title || spec.baseUrl : 'No API connected'}
          </Text>
          {spec && (
            <Text color="gray"> ({spec.baseUrl})</Text>
          )}
        </Box>

        <Box>
          <Text>Env: </Text>
          {isProd ? (
            <Text bold color="red" backgroundColor="black">
              [{activeEnv.name.toUpperCase()}]
            </Text>
          ) : (
            <Text bold color="magenta">
              [{activeEnv.name}]
            </Text>
          )}
        </Box>
      </Box>

      {spec && (
        <Box marginTop={0}>
          <Text color="gray">
            Endpoints: <Text color="white">{spec.endpoints.length}</Text> │ Schemas:{' '}
            <Text color="white">{Object.keys(spec.schemas || {}).length}</Text> │ Source:{' '}
            <Text color="cyan">{spec.endpoints[0]?.source || 'DOCUMENTED'}</Text>
            {loading ? <Text color="yellow"> │ [Busy...]</Text> : null}
          </Text>
        </Box>
      )}
    </Box>
  );
};
