import * as React from 'react';
import { Roboto } from 'next/font/google';
import { createTheme } from '@mui/material/styles';
import { red } from '@mui/material/colors';
import { NextLinkComposed } from './Link';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const LinkBehavior = React.forwardRef(function LinkBehavior(props, ref) {
  const { href, to, ...other } = props;
  return <NextLinkComposed ref={ref} to={to || href} {...other} />;
});

// Create a theme instance.
const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: {
      main: '#556cd6',
    },
    secondary: {
      main: '#19857b',
    },
    error: {
      main: red.A400,
    },
  },
  typography: {
    fontFamily: roboto.style.fontFamily,
  },
  components: {
    MuiLink: {
      defaultProps: {
        component: LinkBehavior,
      },
    },
    MuiButtonBase: {
      defaultProps: {
        LinkComponent: LinkBehavior,
      },
    },
  },
});

export default theme;
