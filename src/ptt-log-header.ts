const WIDTH = 120;

export const getPTTLogHeader = (message: string): string => {
  const fullMessage = `Path To Tarkov: ${message}`;

  return `\
${'='.repeat(WIDTH)}
==== ${fullMessage}
${'='.repeat(WIDTH)}`;
};
