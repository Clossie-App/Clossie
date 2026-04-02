const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export const haptics = {
  light: () => vibrate(15),    // toggles, selections
  success: () => vibrate(20),  // saves, confirms
  error: () => vibrate(50),    // failures, deletes
};
