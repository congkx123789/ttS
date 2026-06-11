import React, { createContext, useContext, useState, useEffect } from 'react';

const ReaderSettingsContext = createContext();

export function ReaderSettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('readerTheme') || 'dark');
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('readerFontSize') || '18'));
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('readerFontFamily') || 'sans');
  const [lineHeight, setLineHeight] = useState(() => localStorage.getItem('readerLineHeight') || 'relaxed');

  useEffect(() => {
    localStorage.setItem('readerTheme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('readerFontSize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('readerFontFamily', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('readerLineHeight', lineHeight);
  }, [lineHeight]);

  const decreaseFontSize = () => setFontSize(prev => Math.max(12, prev - 1));
  const increaseFontSize = () => setFontSize(prev => Math.min(36, prev + 1));

  return (
    <ReaderSettingsContext.Provider value={{
      theme,
      setTheme,
      fontSize,
      setFontSize,
      decreaseFontSize,
      increaseFontSize,
      fontFamily,
      setFontFamily,
      lineHeight,
      setLineHeight
    }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  return useContext(ReaderSettingsContext);
}
