import React from 'react';
export const Zoom = props => (
  <svg viewBox="0 0 20 20"  {...props} className={`sketchybar-app-font ${props.className ? props.className : ''}`}><path d="M17.2536,8.02493913 L17.2536,18.4441739 L3.92128696,18.4441739 C3.92128696,18.4441739 0.111965217,18.8923478 0,14.9711652 L0,5 L13.780487,5 C13.780487,5 17.1415304,5.33610435 17.2536,8.02493913 Z M23.9755826,5 L23.9755826,18.4598261 L18.0381913,14.5230957 L18.0381913,9.03335652 L23.9755826,5 Z" fillRule="evenodd" /></svg>
);
