import React from 'react';
export const Text = props => (
  <svg viewBox="0 0 20 20"  {...props} className={`sketchybar-app-font ${props.className ? props.className : ''}`}><path d="M6 0a6 6 0 0 0-6 6v12a6 6 0 0 0 6 6h12a6 6 0 0 0 6-6V6a6 6 0 0 0-6-6H6Zm.5 7.5a1.5 1.5 0 1 1 0-3h11a1.5 1.5 0 0 1 0 3h-4V18a1.5 1.5 0 1 1-3 0V7.5h-4Z" fillRule="evenodd" /></svg>
);
