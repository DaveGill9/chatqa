export const stripFileExtension = (str: string): string => {
  if (!str || typeof str !== 'string') return str;
  const lastDot = str.lastIndexOf('.');
  return lastDot > 0 ? str.slice(0, lastDot) : str;
};
