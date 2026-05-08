import React, { createContext, useContext, useState } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  appBg: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarHover: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  sidebarBorder: string;
  topNavBg: string;
  topNavText: string;
  topNavActiveTab: string;
  topNavActiveBorder: string;
  contentBg: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  tableHeaderBg: string;
  tableBorder: string;
  tableRowHover: string;
  tableStripe: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  badgeBlueBg: string;
  badgeBlueText: string;
  badgeRedBg: string;
  badgeRedText: string;
  badgeGreenBg: string;
  badgeGreenText: string;
  badgeGrayBg: string;
  badgeGrayText: string;
  statCardBg: string;
  divider: string;
  tagActiveBg: string;
  tagActiveText: string;
  scrollbar: string;
}

const lightColors: ThemeColors = {
  appBg: '#F1E6D8',
  sidebarBg: '#28314E',
  sidebarText: '#D4C9B8',
  sidebarMuted: '#8A9AB8',
  sidebarHover: 'rgba(241,230,216,0.08)',
  sidebarActiveBg: '#AA2B3A',
  sidebarActiveText: '#FFFFFF',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  topNavBg: '#28314E',
  topNavText: '#D0C5B5',
  topNavActiveTab: '#FFFFFF',
  topNavActiveBorder: '#AA2B3A',
  contentBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: '#E8D9C8',
  text: '#2C3550',
  textMuted: '#8A96AE',
  tableHeaderBg: '#F8F2EC',
  tableBorder: '#EDE0D2',
  tableRowHover: '#FDF8F4',
  tableStripe: '#FAFAFA',
  inputBg: '#FFFFFF',
  inputBorder: '#D8C9B8',
  inputText: '#2C3550',
  primary: '#AA2B3A',
  primaryHover: '#8E2230',
  primaryText: '#FFFFFF',
  badgeBlueBg: '#EBF3FF',
  badgeBlueText: '#1E5FAD',
  badgeRedBg: '#FDECEA',
  badgeRedText: '#AA2B3A',
  badgeGreenBg: '#E8F5E9',
  badgeGreenText: '#2E7D32',
  badgeGrayBg: '#F3F4F6',
  badgeGrayText: '#6B7280',
  statCardBg: '#F8F2EC',
  divider: '#EDE0D2',
  tagActiveBg: '#AA2B3A',
  tagActiveText: '#FFFFFF',
  scrollbar: '#D8C9B8',
};

const darkColors: ThemeColors = {
  appBg: '#141D30',
  sidebarBg: '#0E1626',
  sidebarText: '#B8C4D8',
  sidebarMuted: '#5A6A88',
  sidebarHover: 'rgba(241,230,216,0.06)',
  sidebarActiveBg: '#AA2B3A',
  sidebarActiveText: '#FFFFFF',
  sidebarBorder: 'rgba(255,255,255,0.06)',
  topNavBg: '#0E1626',
  topNavText: '#A0B0C8',
  topNavActiveTab: '#F1E6D8',
  topNavActiveBorder: '#AA2B3A',
  contentBg: '#28314E',
  cardBg: '#28314E',
  cardBorder: '#3A4E6E',
  text: '#E8DDD0',
  textMuted: '#7A8EAA',
  tableHeaderBg: '#1E2A40',
  tableBorder: '#364A6A',
  tableRowHover: '#2E3D5A',
  tableStripe: '#2A3650',
  inputBg: '#1E2A40',
  inputBorder: '#3A4E6E',
  inputText: '#E8DDD0',
  primary: '#AA2B3A',
  primaryHover: '#C4364A',
  primaryText: '#FFFFFF',
  badgeBlueBg: '#1A2D4A',
  badgeBlueText: '#7FB3E8',
  badgeRedBg: '#3A1820',
  badgeRedText: '#F08090',
  badgeGreenBg: '#1A3028',
  badgeGreenText: '#68C880',
  badgeGrayBg: '#2A3550',
  badgeGrayText: '#8A9AB8',
  statCardBg: '#1E2A40',
  divider: '#364A6A',
  tagActiveBg: '#AA2B3A',
  tagActiveText: '#FFFFFF',
  scrollbar: '#3A4E6E',
};

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: lightColors,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, colors: theme === 'light' ? lightColors : darkColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
