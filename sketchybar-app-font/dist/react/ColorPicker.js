import React from 'react';
export const ColorPicker = props => (
  <svg viewBox="0 0 20 20"  {...props} className={`sketchybar-app-font ${props.className ? props.className : ''}`}><path d="M22.64 4.22l-2.86-2.86a1.22 1.22 0 00-1.72 0l-3.81 3.81-1.5-1.48a1.22 1.22 0 10-1.72 1.72l.87.88L1.18 17.01a.6.6 0 00-.18.44v4.94c0 .34.27.61.61.61h4.94c.16 0 .32-.06.43-.18L17.69 12.1l.88.88a1.22 1.22 0 101.73-1.72l-1.5-1.5 3.82-3.8c.5-.5.5-1.27.02-1.74zM5.8 20.56L3.45 18.2l9.85-9.85 2.34 2.35-9.85 9.85z" fillRule="evenodd" /></svg>
);
