import { TextStyle } from 'react-native';

export const colors = {
  background: '#E8D6DF',
  backgroundDeep: '#DCCBD7',
  backgroundLight: '#F4E8ED',

  surface: '#FFFFFF',
  surfaceAlt: '#F8F1F4',
  border: '#F3E8ED',

  text: '#000000',
  textMuted: '#6E6168',
  textFaint: '#A99BA3',

  blue: '#03346E',
  blueSoft: '#E3E9F3',
  primary: '#03346E',

  red: '#830000',
  redSoft: '#F4E0E2',

  white: '#FFFFFF',
};

export const layout = {
  screenPadding: 22,
  touch: 52,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#7A5468',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  soft: {
    shadowColor: '#7A5468',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export const type: Record<'display' | 'title' | 'label', TextStyle> = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
};