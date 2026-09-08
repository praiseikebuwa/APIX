import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ProductionWarningProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ProductionWarning: React.FC<ProductionWarningProps> = ({
  message,
  onConfirm,
  onCancel,
}) => {
  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'n') {
      onCancel();
    } else if (input.toLowerCase() === 'y' || (key.return && input.toLowerCase() === 'y')) {
      onConfirm();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="red"
      padding={1}
      width={65}
    >
      <Box marginBottom={1}>
        <Text bold color="red" backgroundColor="black">
          ⚠ PRODUCTION SAFETY WARNING
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="yellow">{message}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="red">
          This operation may permanently modify or delete remote data in PRODUCTION.
        </Text>
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
        <Text bold color="white">
          Press <Text color="green">[y]</Text> to confirm, or <Text color="red">[n / Esc]</Text> to cancel.
        </Text>
      </Box>
    </Box>
  );
};
