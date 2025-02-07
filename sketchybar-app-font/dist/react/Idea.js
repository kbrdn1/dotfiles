import React from 'react';
export const Idea = props => (
  <svg viewBox="0 0 20 20"  {...props} className={`sketchybar-app-font ${props.className ? props.className : ''}`}><path d="M1 1v22h22V1H1zm3.413 2.852h4.583v1.68H7.722v5.755h1.274v1.681H4.413v-1.681h1.323V5.533H4.413V3.852zm10.133 0h2.037V9.81c0 .561-.05 1.018-.203 1.426a2.719 2.719 0 01-.663 1.018c-.254.256-.61.51-1.017.612a3.605 3.605 0 01-1.325.255c-.713 0-1.324-.153-1.782-.408a4.41 4.41 0 01-1.172-.968l1.274-1.425c.254.306.508.508.763.662.254.153.56.254.867.254.356 0 .66-.101.916-.356.203-.255.306-.612.306-1.172V3.852zM3.036 18.875h8.25v1.375h-8.25v-1.375z" fillRule="evenodd" /></svg>
);
