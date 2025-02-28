import React from 'react';
export const Book = props => (
  <svg viewBox="0 0 20 20"  {...props} className={`sketchybar-app-font ${props.className ? props.className : ''}`}><path d="m18.15 1.35-4 4a.5.5 0 0 0-.15.36v8.17c0 .43.51.66.83.37l4-3.6a.48.48 0 0 0 .17-.37V1.71a.5.5 0 0 0-.85-.36zm4.32 3.85c-.47-.24-.96-.44-1.47-.61v12.03a10.29 10.29 0 0 0-9 .96V5.48A11 11 0 0 0 1.53 5.2a.97.97 0 0 0-.53.88v12.08a1 1 0 0 0 1.48.87A8.7 8.7 0 0 1 6.5 18c2.07 0 3.98.82 5.5 2a9.04 9.04 0 0 1 5.5-2c1.45 0 2.81.4 4.02 1.04a1 1 0 0 0 1.48-.87V6.08c0-.37-.2-.72-.53-.88z" fillRule="evenodd" /></svg>
);
