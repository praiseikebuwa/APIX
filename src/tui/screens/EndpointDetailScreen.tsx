import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';
import { CodeGenerator } from '../../core/generators/index.js';

export const EndpointDetailScreen: React.FC = () => {
  const { activeEndpoint, setScreen, spec } = useApp();

  if (!activeEndpoint) {
    return (
      <Box padding={1}>
        <Text color="yellow">No endpoint selected.</Text>
      </Box>
    );
  }

  useInput((input, key) => {
    if (key.escape) {
      setScreen('explorer');
      return;
    }
    if (key.return || input === 'r') {
      setScreen('builder');
      return;
    }
    if (input === 'c') {
      setScreen('code-gen');
    }
  });

  const getMethodColor = (m: string) => {
    switch (m) {
      case 'GET':
        return 'green';
      case 'POST':
        return 'blue';
      case 'PUT':
        return 'yellow';
      case 'DELETE':
        return 'red';
      case 'PATCH':
        return 'magenta';
      default:
        return 'cyan';
    }
  };

  const curlPreview = CodeGenerator.generate('curl', {
    url: `${spec?.baseUrl || 'http://localhost'}${activeEndpoint.path}`,
    method: activeEndpoint.method,
    body: activeEndpoint.requestBody?.example,
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Endpoint Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color={getMethodColor(activeEndpoint.method)}>
            {activeEndpoint.method}{' '}
          </Text>
          <Text bold color="white">
            {activeEndpoint.path}
          </Text>
        </Box>
        <Box>
          <Text color="gray">Source: </Text>
          <Text color="cyan">{activeEndpoint.source}</Text>
        </Box>
      </Box>

      {/* Description */}
      {activeEndpoint.description && (
        <Box marginBottom={1}>
          <Text color="white">{activeEndpoint.description}</Text>
        </Box>
      )}

      {/* Parameters */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          Parameters ({activeEndpoint.parameters.length}):
        </Text>
        {activeEndpoint.parameters.length === 0 ? (
          <Text color="gray">  None required</Text>
        ) : (
          activeEndpoint.parameters.map((p, idx) => (
            <Box key={`${p.name}_${idx}`}>
              <Text color="white">  • </Text>
              <Text bold color="yellow">
                {p.name}
              </Text>
              <Text color="gray"> ({p.in}) </Text>
              {p.required ? <Text color="red">required </Text> : <Text color="gray">optional </Text>}
              {p.description && <Text color="gray">- {p.description}</Text>}
            </Box>
          ))
        )}
      </Box>

      {/* Request Body */}
      {activeEndpoint.requestBody && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            Request Body ({activeEndpoint.requestBody.contentType}):
          </Text>
          {activeEndpoint.requestBody.description && (
            <Text color="gray">  {activeEndpoint.requestBody.description}</Text>
          )}
          {activeEndpoint.requestBody.example && (
            <Box borderStyle="single" borderColor="gray" paddingX={1}>
              <Text color="green">
                {JSON.stringify(activeEndpoint.requestBody.example, null, 2).slice(0, 200)}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Responses */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          Responses:
        </Text>
        {activeEndpoint.responses.map((r, i) => (
          <Box key={`${r.statusCode}_${i}`}>
            <Text color={String(r.statusCode).startsWith('2') ? 'green' : 'yellow'}>
              {'  '}[{r.statusCode}]
            </Text>
            <Text color="gray"> {r.description || 'Response'}</Text>
          </Box>
        ))}
      </Box>

      {/* Action Banner */}
      <Box borderStyle="single" borderColor="green" paddingX={1} justifyContent="space-between">
        <Text bold color="green">
          Press [Enter] to Build &amp; Run Request
        </Text>
        <Text color="gray">[c] Code Generator │ [Esc] Back</Text>
      </Box>
    </Box>
  );
};
